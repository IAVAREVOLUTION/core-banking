import { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  value?: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /**
   * Formato del VALOR que recibe y entrega el componente (la pantalla siempre
   * muestra dd/mm/aaaa):
   *  - 'dmy' (default): "dd/mm/aaaa"
   *  - 'iso': "aaaa-mm-dd" — reemplaza a <input type="date"> sin cambiar lo que se guarda.
   */
  formato?: 'dmy' | 'iso';
  /** Fecha mínima / máxima seleccionable, en el mismo formato que `value`. */
  min?: string;
  max?: string;
  id?: string;
  name?: string;
  title?: string;
  required?: boolean;
  'aria-label'?: string;
}

const RE_DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/** "aaaa-mm-dd" (o ISO con hora) → "dd/mm/aaaa". */
export function isoADmy(v: string): string {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}
/** "dd/mm/aaaa" → "aaaa-mm-dd" ('' si no es una fecha válida). */
export function dmyAIso(v: string): string {
  const m = String(v || '').match(RE_DMY);
  if (!m) return '';
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (d.getDate() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function DatePicker({ value = '', onChange, disabled = false, placeholder = 'dd/mm/aaaa', className = '', formato = 'dmy', min, max, id, name, title, required, 'aria-label': ariaLabel }: DatePickerProps) {
  const esIso = formato === 'iso';
  const valorDmy = esIso ? isoADmy(value) : value;
  // En modo ISO lo tecleado se conserva local hasta que forma una fecha completa.
  const [texto, setTexto] = useState(valorDmy);
  const [enfocado, setEnfocado] = useState(false);
  useEffect(() => { if (!enfocado) setTexto(valorDmy); }, [valorDmy, enfocado]);
  const minDmy = esIso ? isoADmy(min || '') : (min || '');
  const maxDmy = esIso ? isoADmy(max || '') : (max || '');
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showYearSelector, setShowYearSelector] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const calendarRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);

  // Parsear la fecha del formato DD/MM/YYYY
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return null;
  };

  // Formatear fecha a DD/MM/YYYY
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Calcular posición del calendario
  useEffect(() => {
    if (showCalendar && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const calendarHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      const openUpwards = spaceAbove > spaceBelow || spaceBelow < calendarHeight;
      
      setPosition({
        top: openUpwards ? rect.top - calendarHeight - 4 : rect.bottom + 4,
        left: rect.left
      });
    }
  }, [showCalendar]);

  // Cerrar calendario al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
        setShowYearSelector(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  const handleDateSelect = (day: number) => {
    const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const dmy = formatDate(selectedDate);
    setTexto(dmy);
    onChange(esIso ? dmyAIso(dmy) : dmy);
    setShowCalendar(false);
  };

  // Al abrir, mostrar el mes de la fecha elegida (o el actual).
  useEffect(() => {
    if (!showCalendar) return;
    const sel = parseDate(valorDmy);
    setCurrentMonth(sel && !Number.isNaN(sel.getTime()) ? new Date(sel.getFullYear(), sel.getMonth(), 1) : new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCalendar]);

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleYearChange = (year: number) => {
    setCurrentMonth(new Date(year, currentMonth.getMonth(), 1));
    setShowYearSelector(false);
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentMonth);
    const firstDay = getFirstDayOfMonth(currentMonth);
    const days = [];

    // Días vacíos antes del primer día del mes
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="h-7"></div>);
    }

    // Días del mes
    const selectedDate = parseDate(valorDmy);
    const fMin = parseDate(minDmy);
    const fMax = parseDate(maxDmy);
    const hoy = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const fecha = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const fueraDeRango = (fMin && fecha < fMin) || (fMax && fecha > fMax);
      const esHoy = fecha.toDateString() === hoy.toDateString();
      const isSelected = selectedDate && 
        selectedDate.getDate() === day && 
        selectedDate.getMonth() === currentMonth.getMonth() &&
        selectedDate.getFullYear() === currentMonth.getFullYear();

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => !fueraDeRango && handleDateSelect(day)}
          disabled={!!fueraDeRango}
          className={`h-7 text-xs rounded transition-colors ${
            isSelected
              ? 'bg-[color:var(--theme-primary)] text-white'
              : fueraDeRango
                ? 'text-gray-300 cursor-not-allowed'
                : `text-gray-700 hover:bg-gray-200 ${esHoy ? 'ring-1 ring-[color:var(--theme-primary)] font-semibold' : ''}`
          }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  const renderYearSelector = () => {
    const currentYear = currentMonth.getFullYear();
    const startYear = 1920;
    const endYear = 2050;
    const years = [];

    // Generar años desde endYear hasta startYear
    for (let year = endYear; year >= startYear; year--) {
      years.push(
        <button
          key={year}
          type="button"
          onClick={() => handleYearChange(year)}
          className={`px-3 py-1.5 text-xs rounded hover:bg-gray-200 transition-colors text-center ${
            year === currentYear ? 'bg-[color:var(--theme-primary)] text-white' : 'text-gray-700'
          }`}
        >
          {year}
        </button>
      );
    }

    return years;
  };

  return (
    <div className="relative flex-1">
      <div className="relative" ref={buttonRef}>
        <input
          type="text"
          id={id}
          name={name}
          title={title}
          required={required}
          aria-label={ariaLabel}
          value={esIso ? texto : value}
          onChange={(e) => {
            if (!esIso) { onChange(e.target.value); return; }
            const t = e.target.value;
            setTexto(t);
            if (t.trim() === '') onChange('');
            else { const iso = dmyAIso(t.trim()); if (iso) onChange(iso); }
          }}
          onFocus={() => { setEnfocado(true); if (!disabled) setShowCalendar(true); }}
          onBlur={() => setEnfocado(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-2 py-1 pr-8 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[color:var(--theme-primary)] ${
            disabled ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : 'bg-white'
          } ${className}`}
        />
        <button aria-label="Abrir calendario" title="Abrir calendario"
          type="button"
          onClick={() => !disabled && setShowCalendar(!showCalendar)}
          disabled={disabled}
          className={`absolute right-2 top-1/2 -translate-y-1/2 ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="12" height="11" rx="1" />
            <path d="M2 6h12M5 2v3M11 2v3" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {showCalendar && !disabled && (
        <>
          {/* Overlay para cerrar el calendario */}
          <div 
            className="fixed inset-0 z-[55]"
            onClick={() => setShowCalendar(false)}
          />
          
          {/* Calendario con posición fija */}
          <div 
            ref={calendarRef}
            className="fixed z-[60] bg-white border border-gray-300 rounded-lg shadow-lg p-3" 
            style={{ 
              width: '240px',
              top: `${position.top}px`,
              left: `${position.left}px`
            }}
          >
            {!showYearSelector ? (
              <>
                {/* Header del calendario */}
                <div className="flex items-center justify-between mb-2">
                  <button aria-label="Mes anterior" title="Mes anterior"
                    type="button"
                    onClick={previousMonth}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-4 h-4 text-gray-600" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowYearSelector(true)}
                    className="text-xs font-medium text-gray-700 hover:bg-gray-100 px-2 py-1 rounded transition-colors"
                  >
                    {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                  </button>
                  <button aria-label="Mes siguiente" title="Mes siguiente"
                    type="button"
                    onClick={nextMonth}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    <svg className="w-4 h-4 text-gray-600" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {/* Días de la semana */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, index) => (
                    <div key={index} className="h-6 flex items-center justify-center text-[10px] font-medium text-gray-500">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Días del mes */}
                <div className="grid grid-cols-7 gap-1">
                  {renderCalendar()}
                </div>
              </>
            ) : (
              <>
                {/* Selector de año */}
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => setShowYearSelector(false)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    ← Volver
                  </button>
                  <div className="text-xs font-medium text-gray-700">
                    Seleccionar Año
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 max-h-[200px] overflow-y-auto">
                  {renderYearSelector()}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}