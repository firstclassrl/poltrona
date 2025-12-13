import React, { useState, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { Eye, EyeOff, User, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { PrivacyPolicy } from './PrivacyPolicy';
import { Modal } from './ui/Modal';
import { Toast } from './ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';
import { APP_VERSION } from '../config/version';
import { apiService } from '../services/api';
import { API_CONFIG } from '../config/api';
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
    phone: '',
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
  
  const { login, register } = useAuth();
  const { toast, showToast, hideToast } = useToast();
  const { palette } = useTheme();

  // Carica i dati dello shop dallo slug nell'URL
  useEffect(() => {
    const loadShopFromUrl = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const shopSlug = params.get('shop');
        
        if (shopSlug) {
          try {
            const shopData = await apiService.getShopBySlug(shopSlug);
            setShop(shopData);
            
            // Carica il logo dello shop se disponibile
            // 1) prova logo_url salvato (se esiste)
            // 2) prova signed URL pubblico (senza autenticazione, per login page)
            // 3) fallback su URL pubblico da path (se bucket pubblico)
            if (shopData.logo_url) {
              // Prova prima con logo_url salvato
              setShopLogoUrl(shopData.logo_url);
            } else if (shopData.logo_path) {
              try {
                // Prova a generare un signed URL pubblico (senza autenticazione)
                const signed = await apiService.getSignedShopLogoUrlPublic(shopData.logo_path);
                if (signed) {
                  setShopLogoUrl(signed);
                } else {
                  // Fallback su URL pubblico
                  const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/shop-logos/${shopData.logo_path}`;
                  setShopLogoUrl(publicUrl);
                }
              } catch (e) {
                console.warn('Errore caricamento logo:', e);
                // Fallback su URL pubblico
                const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/shop-logos/${shopData.logo_path}`;
                setShopLogoUrl(publicUrl);
              }
            }
          } catch (error) {
            console.warn('Shop non trovato per slug:', shopSlug, error);
            // Fallback: prova a caricare il negozio di default
            try {
              const defaultShop = await apiService.getShop();
              setShop(defaultShop);
              if (defaultShop?.logo_url) {
                setShopLogoUrl(defaultShop.logo_url);
              } else if (defaultShop?.logo_path) {
                const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/shop-logos/${defaultShop.logo_path}`;
                setShopLogoUrl(publicUrl);
              }
            } catch (e) {
              console.warn('Errore caricamento shop di default:', e);
            }
          }
        } else {
          // Nessuno slug, prova a caricare il negozio di default
          try {
            const defaultShop = await apiService.getShop();
            setShop(defaultShop);
            if (defaultShop?.logo_url) {
              setShopLogoUrl(defaultShop.logo_url);
            } else if (defaultShop?.logo_path) {
              const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/shop-logos/${defaultShop.logo_path}`;
              setShopLogoUrl(publicUrl);
            }
          } catch (e) {
            console.warn('Errore caricamento shop di default:', e);
          }
        }
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

    try {
      if (mode === 'login') {
        await login(credentials);
      } else {
        await handleRegistration();
        // Se handleRegistration completa senza errori, il modal viene mostrato dentro handleRegistration
        // Non facciamo nulla qui perché il modal è già stato mostrato
      }
    } catch (err) {
      console.error('❌ Errore in handleSubmit:', err);
      const errorMessage = err instanceof Error ? err.message : 'Errore durante l\'operazione';
      setError(errorMessage);
      
      // Mostra anche un Toast per rendere l'errore più visibile
      showToast(errorMessage, 'error');
      
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

    if (registrationData.password.length < 6) {
      throw new Error('La password deve contenere almeno 6 caratteri');
    }

    // Registra il nuovo utente in Supabase
    const registrationEmail = registrationData.email;
    
    console.log('🔄 Inizio registrazione...');
    
    await register({
      email: registrationData.email,
      password: registrationData.password,
      full_name: `${registrationData.firstName} ${registrationData.lastName}`,
      role: 'client',
      phone: registrationData.phone || undefined,
    });
    
    // Se arriviamo qui, la registrazione è andata a buon fine
    console.log('✅ Registrazione completata con successo - mostro modal');
    
    // Imposta l'email e mostra il modal IMMEDIATAMENTE
    // Usa flushSync per forzare un aggiornamento sincrono dello stato
    flushSync(() => {
      setRegisteredEmail(registrationEmail);
      setShowRegistrationSuccess(true);
    });
    
    console.log('🎯 Stato aggiornato - showRegistrationSuccess:', true);
    console.log('📧 Email registrata:', registrationEmail);
  };

  const handleDemoLogin = (role: 'admin' | 'barber' | 'client') => {
    const demoCredentials = {
      admin: { email: 'admin@barbershop.com', password: 'password' },
      barber: { email: 'barbiere@barbershop.com', password: 'password' },
      client: { email: 'cliente@example.com', password: 'password' },
    };
    
    setCredentials(demoCredentials[role]);
  };

  // Colori per lo sfondo: più scuro (primaryStrong) e più chiaro (accent) per la texture
  const bgColor = palette?.colors.primaryStrong || '#1b3015';
  const bgColorMid = palette?.colors.primary || '#25401c';
  const textureColor = palette?.colors.accent || '#eecf54';
  const patternId = `barbershop-pattern-${palette?.id || 'default'}`;
  
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden login-liquid"
      style={{
        background: `linear-gradient(to bottom right, ${bgColor}, ${bgColorMid}, ${bgColor})`
      }}
    >
      <div className="login-grain"></div>
      {/* Pattern di sfondo con colori del tema */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id={patternId} x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              {/* Linee diagonali */}
              <line x1="0" y1="0" x2="60" y2="60" stroke={textureColor} strokeWidth="2"/>
              <line x1="60" y1="0" x2="0" y2="60" stroke={textureColor} strokeWidth="2"/>
              {/* Cerchi decorativi */}
              <circle cx="30" cy="30" r="3" fill={textureColor}/>
              <circle cx="0" cy="0" r="2" fill={textureColor}/>
              <circle cx="60" cy="60" r="2" fill={textureColor}/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`}/>
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
            <div className="w-20 h-20 mx-auto mb-4">
              {shopLogoUrl ? (
                <img 
                  src={shopLogoUrl} 
                  alt={`Logo ${shop?.name || 'negozio'}`} 
                  className="w-full h-full object-contain filter brightness-110 rounded-lg"
                  onError={(e) => {
                    console.warn('Errore caricamento logo shop, uso logo default');
                    const target = e.target as HTMLImageElement;
                    target.src = '/logo Poltrona 2025.png';
                  }}
                />
              ) : (
                <img 
                  src="/logo Poltrona 2025.png" 
                  alt="Logo ufficiale Poltrona" 
                  className="w-full h-full object-contain filter brightness-110"
                />
              )}
            </div>
          )}
          <h1 className="text-2xl font-bold text-green-900">
            {shop?.name || 'Poltrona'}
          </h1>
          <p className="text-green-800 mt-2">
            {mode === 'login' ? 'Accedi al tuo account' : 'Crea il tuo account'}
          </p>
        </div>

        {/* Nessun toggle: default login. Link sotto il tasto principale */}

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
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
                  value={credentials.email}
                  onChange={(e) => setCredentials(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Inserisci la tua email"
                  autoComplete="off"
                  required
                />
              </div>

              <div>
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
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
                  required
                />
                <Input
                  label="Cognome"
                  value={registrationData.lastName}
                  onChange={(e) => setRegistrationData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Rossi"
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
                  required
                />
              </div>

              <div>
                <div className="relative">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    value={registrationData.password}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="Inserisci una password"
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
                    value={registrationData.confirmPassword}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Conferma la password"
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
          >
            {mode === 'login' ? 'Accedi' : 'Registrati'}
          </Button>

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
        console.log('🔍 Render modal - showRegistrationSuccess:', showRegistrationSuccess);
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
                    phone: '',
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
                      phone: '',
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
