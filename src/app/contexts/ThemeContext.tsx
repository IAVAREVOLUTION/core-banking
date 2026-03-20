import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'blue' | 'red' | 'green';

interface ThemeColors {
  name: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  secondary: string;
  secondaryHover: string;
  accent: string;
  accentHover: string;
  brandDark1: string;
  brandDark2: string;
  brandDark3: string;
}

const themes: Record<Theme, ThemeColors> = {
  blue: {
    name: 'Azul Institucional',
    primary: '#4A6FA5',
    primaryHover: '#3A5A85',
    primaryLight: '#E3EBF5',
    secondary: '#2E5C91',
    secondaryHover: '#1E4C81',
    accent: '#5B9BD5',
    accentHover: '#4A8BC2',
    brandDark1: '#4A6FA5',
    brandDark2: '#3A5A85',
    brandDark3: '#2A4565',
  },
  red: {
    name: 'Rojo Institucional',
    primary: '#C95361',
    primaryHover: '#A94350',
    primaryLight: '#F9E8EA',
    secondary: '#C8102E',
    secondaryHover: '#A00D28',
    accent: '#E07B85',
    accentHover: '#D06B75',
    brandDark1: '#C8102E',
    brandDark2: '#A00D28',
    brandDark3: '#8B0A21',
  },
  green: {
    name: 'Verde Profesional',
    primary: '#2E7D32',
    primaryHover: '#1B5E20',
    primaryLight: '#E8F5E9',
    secondary: '#1B5E20',
    secondaryHover: '#0D3D10',
    accent: '#66BB6A',
    accentHover: '#57A85B',
    brandDark1: '#2E7D32',
    brandDark2: '#1B5E20',
    brandDark3: '#0D3D10',
  },
};

interface ThemeContextType {
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
  themes: Record<Theme, ThemeColors>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Función auxiliar para aplicar estilos del tema
  const applyThemeStyles = (theme: Theme) => {
    const root = document.documentElement;
    const selectedTheme = themes[theme];

    // Variables para login
    root.style.setProperty('--login-primary', selectedTheme.primary);
    root.style.setProperty('--login-primary-hover', selectedTheme.primaryHover);
    root.style.setProperty('--login-primary-light', selectedTheme.primaryLight);
    root.style.setProperty('--login-brand-dark-1', selectedTheme.brandDark1);
    root.style.setProperty('--login-brand-dark-2', selectedTheme.brandDark2);
    root.style.setProperty('--login-brand-dark-3', selectedTheme.brandDark3);

    // Variables para el sistema completo
    root.style.setProperty('--theme-primary', selectedTheme.primary);
    root.style.setProperty('--theme-primary-hover', selectedTheme.primaryHover);
    root.style.setProperty('--theme-primary-light', selectedTheme.primaryLight);
    root.style.setProperty('--theme-secondary', selectedTheme.secondary);
    root.style.setProperty('--theme-secondary-hover', selectedTheme.secondaryHover);
    root.style.setProperty('--theme-accent', selectedTheme.accent);
    root.style.setProperty('--theme-accent-hover', selectedTheme.accentHover);
    
    // Variable para encabezados de tabla (gris claro siempre, no depende del tema)
    root.style.setProperty('--theme-table-header', '#D0D0D0');
  };

  // Cargar el tema inicial desde localStorage ANTES del primer render
  const getInitialTheme = (): Theme => {
    const savedTheme = localStorage.getItem('loginTheme') as Theme | null;
    if (savedTheme && themes[savedTheme]) {
      // Aplicar inmediatamente ANTES del render
      applyThemeStyles(savedTheme);
      return savedTheme;
    }
    // Si no hay tema guardado, aplicar azul por defecto
    applyThemeStyles('blue');
    return 'blue';
  };

  const [currentTheme, setCurrentTheme] = useState<Theme>(getInitialTheme);

  // Cargar tema desde localStorage al montar
  useEffect(() => {
    const savedTheme = localStorage.getItem('loginTheme') as Theme | null;
    if (savedTheme && themes[savedTheme]) {
      setCurrentTheme(savedTheme);
      applyThemeStyles(savedTheme);
    } else {
      applyThemeStyles('blue'); // Tema por defecto
    }
  }, []);

  const setTheme = (theme: Theme) => {
    setCurrentTheme(theme);
    applyThemeStyles(theme);
    localStorage.setItem('loginTheme', theme);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}