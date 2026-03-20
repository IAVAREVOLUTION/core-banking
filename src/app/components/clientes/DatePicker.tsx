import { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ value, onChange, disabled = false, placeholder = 'DD/MM/YYYY', className = '' }: DatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showYearSelector, setShowYearSelector] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

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
    onChange(formatDate(selectedDate));
    setShowCalendar(false);
  };

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
    const selectedDate = parseDate(value);
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = selectedDate && 
        selectedDate.getDate() === day && 
        selectedDate.getMonth() === currentMonth.getMonth() &&
        selectedDate.getFullYear() === currentMonth.getFullYear();

      days.push(
        <button
          key={day}
          type="button"
          onClick={() => handleDateSelect(day)}
          className={`h-7 text-xs rounded hover:bg-gray-200 transition-colors ${
            isSelected ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-gray-700'
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
    const endYear = new Date().getFullYear();
    const years = [];

    // Generar años desde 1920 hasta el año actual
    for (let year = endYear; year >= startYear; year--) {
      years.push(
        <button
          key={year}
          type="button"
          onClick={() => handleYearChange(year)}
          className={`px-3 py-1.5 text-xs rounded hover:bg-gray-200 transition-colors text-left ${
            year === currentYear ? 'bg-blue-500 text-white hover:bg-blue-600' : 'text-gray-700'
          }`}
        >
          {year}
        </button>
      );
    }

    return years;
  };

  return (
    <div className="relative" ref={calendarRef}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => !disabled && setShowCalendar(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-2 py-1 pr-8 text-xs border border-gray-300 rounded ${
            disabled ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
          } ${className}`}
        />
        <button
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
        <div className="absolute z-50 bottom-full mb-2 left-0 bg-white border border-gray-300 rounded-lg shadow-lg p-3" style={{ width: '240px' }}>
          {!showYearSelector ? (
            <>
              {/* Header del calendario */}
              <div className="flex items-center justify-between mb-2">
                <button
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
                <button
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
      )}
    </div>
  );
}