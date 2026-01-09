import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Eye, EyeOff, User, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { PrivacyPolicy } from './PrivacyPolicy';
import { Modal } from './ui/Modal';
import { Toast } from './ui/Toast';
import { ForgotPassword } from './ForgotPassword';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';
import { APP_VERSION } from '../config/version';
import { apiService } from '../services/api';
import { API_CONFIG } from '../config/api';
import { extractSlugFromLocation } from '../utils/slug';
import type { Shop } from '../types';

export const Login: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [registrationData, setRegistrationData] = useState({
    firstName: '',
    lastName: '',
    phone: '+39 ',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);
  const [hasJustRegistered, setHasJustRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [isLoadingShop, setIsLoadingShop] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { login, register, signInWithGoogle, isLoading } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { palette, themeId } = useTheme();

  // Controlla se c'è un errore OAuth salvato in localStorage (redirect fallito)
  useEffect(() => {
    const oauthError = localStorage.getItem('oauth_error');
    if (oauthError) {
      console.log('[Login] Found OAuth error in localStorage:', oauthError);
      setError(oauthError);
      showToast(oauthError, 'error');
      // Rimuovi l'errore dopo averlo mostrato
      localStorage.removeItem('oauth_error');
    }

    // Controlla se c'è un messaggio di successo dal reset password
    const passwordResetSuccess = localStorage.getItem('password_reset_success');
    if (passwordResetSuccess) {
      console.log('[Login] Found password reset success in localStorage:', passwordResetSuccess);
      setSuccess(passwordResetSuccess);
      showToast(passwordResetSuccess, 'success');
      // Rimuovi il messaggio dopo averlo mostrato
      localStorage.removeItem('password_reset_success');
    }
  }, [showToast]);

  // Carica i dati dello shop dallo slug nell'URL
  useEffect(() => {
    const loadShopFromUrl = async () => {
      try {
        const shopSlug = extractSlugFromLocation();

        if (shopSlug) {
          try {
            const shopData = await apiService.getShopBySlug(shopSlug);
            setShop(shopData);

            // Carica il logo dello shop se disponibile
            if (shopData.logo_url) {
              setShopLogoUrl(shopData.logo_url);
            } else if (shopData.logo_path) {
              try {
                const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/shop-logos/${shopData.logo_path}`;
                setShopLogoUrl(publicUrl);
              } catch (e) {
                const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/shop-logos/${shopData.logo_path}`;
                setShopLogoUrl(publicUrl);
              }
            }
          } catch (error) {
            // Slug invalido o shop non trovato: restiamo sulla login generica
            console.warn('Shop not found for slug:', shopSlug);
          }
        }
        // Se non c'è slug, restiamo sulla login generica (shop = null)
      } catch (error) {
        console.error('Errore caricamento shop:', error);
      } finally {
        setIsLoadingShop(false);
      }
    };

    void loadShopFromUrl();
  }, []);

  // Previeni lo scroll quando il modal è aperto
  useEffect(() => {
    if (showRegistrationSuccess) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showRegistrationSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    console.log('[Login] handleSubmit called, mode:', mode);

    try {
      if (mode === 'login') {
        console.log('[Login] Attempting login with email:', credentials.email);
        await login({ ...credentials, rememberMe });
        console.log('[Login] Login successful');
        // Login riuscito - mostra toast di successo
        showToast('Accesso effettuato con successo!', 'success');
      } else {
        console.log('[Login] Attempting registration');
        await handleRegistration();
        // Se handleRegistration completa senza errori, il modal viene mostrato dentro handleRegistration
        // Non facciamo nulla qui perché il modal è già stato mostrato
      }
    } catch (err) {
      console.error('❌ [Login] Errore in handleSubmit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Errore durante l\'operazione';
      console.log('[Login] Setting error state:', errorMessage);

      // Imposta l'errore nello stato
      setError(errorMessage);

      // Assicurati che il modal non sia mostrato in caso di errore
      setShowRegistrationSuccess(false);
    }
  };

  const handleRegistration = async () => {
    // Verifica consenso privacy
    if (!privacyAccepted) {
      throw new Error('Devi accettare l\'Informativa Privacy per procedere');
    }

    // Validazione password
    if (registrationData.password !== registrationData.confirmPassword) {
      throw new Error('Le password non coincidono');
    }

    // Validazione telefono
    if (registrationData.phone.trim().replace(/\s/g, '') === '+39' || registrationData.phone.length < 8) {
      throw new Error('Inserisci un numero di telefono valido');
    }

    if (registrationData.password.length < 6) {
      throw new Error('La password deve contenere almeno 6 caratteri');
    }

    // Normalizzazione e validazione telefono
    let formattedPhone = registrationData.phone.replace(/[^0-9+]/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+39' + formattedPhone;
    }

    if (formattedPhone === '+39' || formattedPhone.length < 8) {
      throw new Error('Inserisci un numero di telefono valido');
    }

    // Registra il nuovo utente in Supabase
    const registrationEmail = registrationData.email;


    await register({
      email: registrationData.email,
      password: registrationData.password,
      full_name: `${registrationData.firstName} ${registrationData.lastName}`,
      role: 'client',
      phone: formattedPhone,
    });

    // Se arriviamo qui, la registrazione è andata a buon fine

    // Imposta l'email e mostra il modal IMMEDIATAMENTE
    // Usa flushSync per forzare un aggiornamento sincrono dello stato
    flushSync(() => {
      setRegisteredEmail(registrationEmail);
      setShowRegistrationSuccess(true);
    });

  };

  const handleDemoLogin = (role: 'admin' | 'barber' | 'client') => {
    const demoCredentials = {
      admin: { email: 'admin@barbershop.com', password: 'password' },
      barber: { email: 'barbiere@barbershop.com', password: 'password' },
      client: { email: 'cliente@example.com', password: 'password' },
    };

    setCredentials(demoCredentials[role]);
  };

  // Se non c'è uno shop specifico, usa i colori del tema Aurora
  // Altrimenti usa i colori del tema dello shop (o default heritage se non specificato)
  const bgColor = shop ? (palette?.colors.primaryStrong || '#1b3015') : '#5b7cff'; // Aurora primaryStrong (approx)
  const bgColorMid = shop ? (palette?.colors.primary || '#25401c') : '#c8e4ff'; // Aurora light blue
  const bgColorEnd = shop ? (palette?.colors.primaryStrong || '#1b3015') : '#9b7bff'; // Aurora violet accent

  // Texture
  const isHeritageTheme = shop && themeId === 'heritage';
  const textureColor = isHeritageTheme
    ? palette?.colors.accent || '#eecf54'
    : shop ? '#ffffff' : '#ffffff'; // Bianco anche per Aurora

  const patternId = `barbershop-pattern-${shop ? (palette?.id || 'default') : 'aurora'}`;

  // Custom Gradient per Aurora
  const backgroundStyle = shop
    ? { background: `linear-gradient(to bottom right, ${bgColor}, ${bgColorMid}, ${bgColor})` }
    : { background: `linear-gradient(135deg, #f7fbff 0%, #c8e4ff 40%, #c7c5ff 100%)` }; // Aurora gradient da palette

  // Se mostra forgot password, non renderizzare il resto
  if (showForgotPassword) {
    return (
      <ForgotPassword
        onBack={() => setShowForgotPassword(false)}
        onSuccess={() => setShowForgotPassword(false)}
      />
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden login-liquid"
      style={backgroundStyle}
    >
      <div className="login-grain"></div>
      {/* Pattern di sfondo con colori del tema */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={patternId} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              {/* Linee diagonali */}
              <line x1="0" y1="0" x2="60" y2="60" stroke={textureColor} strokeWidth="2" />
              <line x1="60" y1="0" x2="0" y2="60" stroke={textureColor} strokeWidth="2" />
              {/* Cerchi decorativi */}
              <circle cx="30" cy="30" r="3" fill={textureColor} />
              <circle cx="0" cy="0" r="2" fill={textureColor} />
              <circle cx="60" cy="60" r="2" fill={textureColor} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
      </div>

      {/* Overlay sfumato con colore del tema */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to top, ${bgColor}30, transparent, ${bgColor}30)`
        }}
      ></div>

      {/* Card principale - sopra il pattern */}
      <Card className="w-full max-w-md p-8 bg-white/25 backdrop-blur-2xl border border-white/30 shadow-2xl relative z-10 login-card-glass">
        <div className="text-center mb-8">
          {isLoadingShop ? (
            <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-green-300 border-t-green-900 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className={`w-24 h-24 mx-auto mb-4 ${!shop ? 'rounded-full overflow-hidden shadow-lg border-2 border-white/50' : ''}`}>
              {shop && shopLogoUrl ? (
                <img
                  src={shopLogoUrl}
                  alt={`Logo ${shop.name}`}
                  className="w-full h-full object-contain filter brightness-110 rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : !shop ? (
                <img
                  src="/logo_aurora.jpg"
                  alt="Poltrona"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 bg-white/20 rounded-lg flex items-center justify-center mx-auto">
                  <User className="w-10 h-10 text-white/50" />
                </div>
              )}
            </div>
          )}
          <h1 className={`text-2xl font-bold ${shop ? 'text-green-900' : 'text-slate-800'}`}>
            {shop?.name || 'Benvenuto su Poltrona'}
          </h1>
          <p className={`mt-2 ${shop ? 'text-green-800' : 'text-slate-600'}`}>
            {mode === 'login' ? 'Accedi al tuo account' : 'Crea il tuo account'}
          </p>
        </div>

        {/* Nessun toggle: default login. Link sotto il tasto principale */}

        {/* Google OAuth Button e Divider - Solo in modalità registrazione, sopra il form */}
        {mode === 'register' && (
          <>
            <Button
              type="button"
              variant="secondary"
              className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 flex items-center justify-center space-x-2 mb-6"
              onClick={async () => {
                try {
                  setError('');
                  await signInWithGoogle();
                  // Il redirect avviene automaticamente, non serve altro
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : 'Errore durante l\'autenticazione Google';
                  setError(errorMessage);
                  showToast(errorMessage, 'error');
                }
              }}
              disabled={isLoading}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Continua con Google</span>
            </Button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white/25 text-gray-700">oppure</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {mode === 'login' ? (
            // Form Login
            <>
              {hasJustRegistered && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 text-sm">
                    Registrazione completata! Inserisci la tua password per accedere.
                  </p>
                </div>
              )}
              <div>
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  id="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Inserisci la tua email"
                  autoComplete="username"
                  required
                />
              </div>

              <div>
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    name="current-password"
                    id="current-password"
                    value={credentials.password}
                    onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Inserisci la tua password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-sm text-green-900">Ricordami</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-yellow-300 hover:text-yellow-200 underline font-medium"
                  >
                    Password dimenticata?
                  </button>
                </div>
              </div>
            </>
          ) : (
            // Form Registrazione
            <>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Nome"
                  value={registrationData.firstName}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Mario"
                  autoComplete="given-name"
                  required
                />
                <Input
                  label="Cognome"
                  value={registrationData.lastName}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Rossi"
                  autoComplete="family-name"
                  required
                />
              </div>

              <div>
                <Input
                  label="Numero di Telefono"
                  type="tel"
                  value={registrationData.phone}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+39 123 456 7890"
                  autoComplete="tel"
                  required
                />
              </div>

              <div>
                <Input
                  label="Email"
                  type="email"
                  value={registrationData.email}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="mario.rossi@email.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    name="new-password"
                    id="new-password"
                    value={registrationData.password}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Inserisci una password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <div className="relative">
                  <Input
                    label="Conferma Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirm-password"
                    id="confirm-password"
                    value={registrationData.confirmPassword}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Conferma la password"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Privacy Checkbox - Solo in registrazione */}
          {mode === 'register' && (
            <div className="space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    required
                  />
                  <span className="text-sm text-gray-700">
                    Ho letto e accetto{' '}
                    <button
                      type="button"
                      onClick={() => setShowPrivacyPolicy(true)}
                      className="text-blue-600 hover:text-blue-800 underline font-medium"
                    >
                      l'Informativa Privacy
                    </button>
                    {' '}*
                  </span>
                </label>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-xs leading-relaxed">
                  I tuoi dati personali saranno utilizzati esclusivamente per la gestione delle prenotazioni
                  e l'erogazione dei servizi richiesti. Non saranno utilizzati per finalità di marketing.
                  Hai diritto di accedere, rettificare e cancellare i tuoi dati in qualsiasi momento.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-semibold text-sm mb-1">Errore di accesso</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-green-600 text-sm">{success}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={mode === 'register' && !privacyAccepted}
            loading={isLoading}
          >
            {mode === 'login' ? 'Accedi' : 'Registrati'}
          </Button>

          {/* Google OAuth Button e Divider - Solo in modalità login, dopo il form */}
          {mode === 'login' && (
            <>
              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white/25 text-gray-700">oppure</span>
                </div>
              </div>

              {/* Google OAuth Button */}
              <Button
                type="button"
                variant="secondary"
                className="w-full bg-white hover:bg-gray-50 text-gray-900 border border-gray-300 flex items-center justify-center space-x-2"
                onClick={async () => {
                  try {
                    setError('');
                    await signInWithGoogle();
                    // Il redirect avviene automaticamente, non serve altro
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Errore durante l\'autenticazione Google';
                    setError(errorMessage);
                    showToast(errorMessage, 'error');
                  }
                }}
                disabled={isLoading}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continua con Google</span>
              </Button>
            </>
          )}

          {/* Link switch login/registrazione */}
          {mode === 'login' ? (
            <p className="text-center text-sm">
              <span className="text-green-900">Non hai un account?</span>{' '}
              <button
                type="button"
                onClick={() => setMode('register')}
                className="font-semibold underline text-yellow-300 hover:text-yellow-200"
              >
                Registrati
              </button>
            </p>
          ) : (
            <p className="text-center text-sm">
              <span className="text-green-900">Hai già un account?</span>{' '}
              <button
                type="button"
                onClick={() => setMode('login')}
                className="font-semibold underline text-yellow-300 hover:text-yellow-200"
              >
                Accedi
              </button>
            </p>
          )}
        </form>

        {/* Nessun account demo in produzione */}
      </Card>

      {/* Modale successo registrazione - FORZATO IN PRIMO PIANO */}
      {(() => {
        return null;
      })()}
      {showRegistrationSuccess && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm"
          style={{ zIndex: 99999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={(e) => {
            // Previeni la chiusura cliccando fuori dal modal
            if (e.target === e.currentTarget) {
              // Opzionale: permettere la chiusura cliccando fuori
            }
          }}
        >
          <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Registrazione completata</h2>
              <button
                onClick={() => {
                  setRegistrationData({
                    firstName: '',
                    lastName: '',
                    phone: '+39 ',
                    email: '',
                    password: '',
                    confirmPassword: '',
                  });
                  setPrivacyAccepted(false);
                  setShowRegistrationSuccess(false);
                  setHasJustRegistered(true);
                  setMode('login');
                  setCredentials(prev => ({ ...prev, email: registeredEmail, password: '' }));
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <p className="text-gray-700">
                  La tua registrazione è andata a buon fine! Ora puoi accedere utilizzando le credenziali appena create.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                  <p className="text-blue-800 text-sm text-center leading-relaxed">
                    <strong>📧 Controlla la tua email</strong>
                    <br />
                    Ti abbiamo inviato un'email di conferma. Se non la trovi nella posta in arrivo, <strong>controlla anche la cartella spam</strong> della tua casella email.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setRegistrationData({
                      firstName: '',
                      lastName: '',
                      phone: '+39 ',
                      email: '',
                      password: '',
                      confirmPassword: '',
                    });
                    setPrivacyAccepted(false);
                    setShowRegistrationSuccess(false);
                    setHasJustRegistered(true);
                    setMode('login');
                    setCredentials(prev => ({ ...prev, email: registeredEmail, password: '' }));
                  }}
                >
                  Vai al login
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      <PrivacyPolicy
        isOpen={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
      />

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />

      {/* Versione e Copyright */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center text-white/70 text-sm z-10">
        <p>Poltrona v{APP_VERSION}</p>
        <p>Copyright 2025 abruzzo.ai</p>
      </div>
    </div>
  );
};