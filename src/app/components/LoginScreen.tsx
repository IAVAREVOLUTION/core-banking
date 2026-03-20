import { useState } from 'react';
import efinanciaLogo from '@/assets/7b6cb23c00b7817818c638af3eae0a416e1e9f57.png';
import { useTheme, Theme } from '@/app/contexts/ThemeContext';

interface LoginScreenProps {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [recordarme, setRecordarme] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  
  // Usar el ThemeContext global
  const { currentTheme, setTheme, themes } = useTheme();

  // Cambiar tema usando el context
  const handleThemeChange = (theme: Theme) => {
    setTheme(theme);
    setShowThemeMenu(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validación básica: admin / admin
    setTimeout(() => {
      if (usuario === 'admin' && password === 'admin') {
        onLogin();
      } else {
        setError('Usuario o contraseña incorrectos');
        setLoading(false);
      }
    }, 800);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div 
        className="hidden lg:flex lg:w-1/2 p-12 flex-col justify-between text-white relative overflow-hidden"
        style={{
          backgroundColor: 'var(--login-brand-dark-1)',
          backgroundImage: 'url(https://images.unsplash.com/photo-1726065235158-d9c3f817f331?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkaWdpdGFsJTIwYmFua2luZyUyMHRlY2hub2xvZ3l8ZW58MXx8fHwxNzY4NDA2MTM5fDA&ixlib=rb-4.1.0&q=80&w=1080)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay oscuro para mejorar legibilidad */}
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom right, 
              color-mix(in srgb, var(--login-brand-dark-1) 95%, transparent), 
              color-mix(in srgb, var(--login-brand-dark-2) 90%, transparent), 
              color-mix(in srgb, var(--login-brand-dark-3) 85%, transparent))`
          }}
        ></div>
        
        <div className="relative z-10">
          {/* Logo Section - Centrado y más grande */}
          <div className="flex flex-col items-center mb-16">
            {/* Fondo ovalado blanco detrás del logo */}
            <div className="relative flex items-center justify-center mb-6">
              <div 
                className="absolute bg-white rounded-full" 
                style={{
                  width: '280px',
                  height: '110px'
                }}
              ></div>
              <img 
                src={efinanciaLogo} 
                alt="assets\7b6cb23c00b7817818c638af3eae0a416e1e9f57.png" 
                className="h-52 relative z-10"
              />
            </div>
            <h1 className="text-4xl font-light text-white">Bienvenido</h1>
          </div>

          {/* Main Title */}
          <div className="mt-24 text-center">
            <h1 className="text-5xl font-light mb-6 leading-tight">
              SISTEMA DE<br />
              CORE BANKING
            </h1>
            <div className="w-24 h-1 bg-white/40 mb-8 mx-auto"></div>
            <p className="text-xl font-light opacity-90 leading-relaxed">
              Soluciones financieras integrales<br />
              para instituciones del futuro
            </p>
          </div>
        </div>

        {/* Bottom branding */}
        <div className="relative z-10 flex flex-col items-center gap-4 opacity-90">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
              <span>Banca Digital</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
              <span>NeoBanco</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                <polyline points="7.5 4.21 12 6.81 16.5 4.21"/>
                <polyline points="7.5 19.79 7.5 14.6 3 12"/>
                <polyline points="21 12 16.5 14.6 16.5 19.79"/>
                <polyline points="3 12 12 17 21 12"/>
              </svg>
              <span>Open Banking</span>
            </div>
          </div>
          <p className="text-sm">
            Sistema de gestión financiera empresarial
          </p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 bg-[#F5F5F5] flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img src={efinanciaLogo} alt="eFinanciaN@t" className="h-12" />
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 relative">
            {/* Theme Switcher - Esquina superior derecha */}
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                title="Cambiar tema de color"
                type="button"
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  className="text-gray-600"
                >
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6m5-11l-4 4m-2 2l-4 4m11-5h-6m-6 0H1m11-5l4 4m2 2l4 4"/>
                </svg>
              </button>

              {/* Menú de temas */}
              {showThemeMenu && (
                <div className="absolute top-12 right-0 bg-white border border-gray-300 rounded-lg shadow-lg py-2 z-10 min-w-[180px]">
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase">
                    Seleccionar Tema
                  </div>
                  <div className="border-t border-gray-200 my-1"></div>
                  
                  {/* Tema Azul */}
                  <button
                    onClick={() => handleThemeChange('blue')}
                    className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      currentTheme === 'blue' ? 'bg-blue-50' : ''
                    }`}
                    type="button"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary-theme border-2 border-white shadow"></div>
                    <span className="text-sm text-gray-700">Azul Institucional</span>
                    {currentTheme === 'blue' && (
                      <svg className="w-4 h-4 ml-auto text-primary-theme" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>

                  {/* Tema Rojo */}
                  <button
                    onClick={() => handleThemeChange('red')}
                    className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      currentTheme === 'red' ? 'bg-red-50' : ''
                    }`}
                    type="button"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#C95361] border-2 border-white shadow"></div>
                    <span className="text-sm text-gray-700">Rojo Institucional</span>
                    {currentTheme === 'red' && (
                      <svg className="w-4 h-4 ml-auto text-[#C95361]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>

                  {/* Tema Verde */}
                  <button
                    onClick={() => handleThemeChange('green')}
                    className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                      currentTheme === 'green' ? 'bg-green-50' : ''
                    }`}
                    type="button"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#2E7D32] border-2 border-white shadow"></div>
                    <span className="text-sm text-gray-700">Verde Profesional</span>
                    {currentTheme === 'green' && (
                      <svg className="w-4 h-4 ml-auto text-[#2E7D32]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-light text-gray-800 mb-2">
                Bienvenido al Sistema
              </h2>
              <p className="text-sm text-gray-600">
                Ingrese sus credenciales para acceder al sistema de Core Banking
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Usuario
                </label>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  placeholder="Ingrese su usuario"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                  style={{
                    '--tw-ring-color': 'var(--login-primary)',
                  } as React.CSSProperties}
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:border-transparent text-sm"
                  style={{
                    '--tw-ring-color': 'var(--login-primary)',
                  } as React.CSSProperties}
                  disabled={loading}
                  required
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordarme}
                    onChange={(e) => setRecordarme(e.target.checked)}
                    className="w-4 h-4 border-gray-300 rounded"
                    style={{
                      accentColor: 'var(--login-primary)',
                    }}
                    disabled={loading}
                  />
                  <span className="text-sm text-gray-600">Recordar mis datos</span>
                </label>
                <button
                  type="button"
                  className="text-sm font-medium transition-colors"
                  style={{
                    color: 'var(--login-primary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--login-primary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--login-primary)';
                  }}
                  disabled={loading}
                >
                  ¿Olvidó su contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full text-white py-3 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--login-primary)',
                }}
                onMouseEnter={(e) => {
                  if (!loading) {
                    e.currentTarget.style.backgroundColor = 'var(--login-primary-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--login-primary)';
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    Ingresando...
                  </span>
                ) : (
                  'Ingresar al Sistema'
                )}
              </button>
            </form>

            {/* Info Box */}
            <div 
              className="mt-6 p-4 border rounded"
              style={{
                backgroundColor: 'var(--login-primary-light)',
                borderColor: 'var(--login-primary)',
              }}
            >
              <p 
                className="text-xs mb-1 font-medium"
                style={{ color: 'var(--login-primary-hover)' }}
              >
                Credenciales de prueba:
              </p>
              <p 
                className="text-xs"
                style={{ color: 'var(--login-primary)' }}
              >
                Usuario: <span className="font-mono font-medium">admin</span> / 
                Contraseña: <span className="font-mono font-medium">admin</span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>© 2025 eFinanciaN@t - Core Banking System</p>
            <p className="mt-1">Todos los derechos reservados</p>
          </div>
        </div>
      </div>
    </div>
  );
}