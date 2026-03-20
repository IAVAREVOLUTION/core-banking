import { useState, useEffect } from 'react';

interface PercentageInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
}

export function PercentageInput({
  value,
  onChange,
  disabled = false,
  placeholder = '0.00%',
  className = '',
  min = 0,
  max = 100,
}: PercentageInputProps) {
  const [error, setError] = useState('');

  // Strip % suffix for internal representation
  const stripPercent = (val: string): string => {
    return val.replace(/%/g, '').trim();
  };

  const handleChange = (inputValue: string) => {
    const cleanValue = stripPercent(inputValue);

    // Allow empty value
    if (cleanValue === '') {
      setError('');
      onChange('');
      return;
    }

    // Only allow numbers, dots, and negative sign
    if (!/^-?\d*\.?\d*$/.test(cleanValue)) {
      return; // Don't update if not a valid number pattern
    }

    const numValue = parseFloat(cleanValue);

    if (!isNaN(numValue)) {
      if (numValue < min) {
        setError(`Mínimo: ${min}%`);
      } else if (numValue > max) {
        setError(`Máximo: ${max}%`);
      } else {
        setError('');
      }
    }

    onChange(cleanValue);
  };

  const handleBlur = () => {
    if (value && !value.endsWith('%')) {
      const cleanValue = stripPercent(value);
      if (cleanValue && !isNaN(parseFloat(cleanValue))) {
        onChange(`${cleanValue}%`);
      }
    }
  };

  const handleFocus = () => {
    // Remove % suffix on focus for easier editing
    if (value && value.endsWith('%')) {
      onChange(stripPercent(value));
    }
  };

  // Clear error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        onFocus={handleFocus}
        disabled={disabled}
        placeholder={placeholder}
        className={`${className} ${error ? 'border-red-400' : ''} ${
          disabled ? 'bg-gray-100 text-gray-600 cursor-not-allowed' : ''
        }`}
      />
      {error && (
        <div className="absolute left-0 top-full mt-0.5 text-[10px] text-red-500 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  );
}
