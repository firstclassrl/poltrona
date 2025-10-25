import React, { useState } from 'react';
import { Eye, EyeOff, User } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { PrivacyPolicy } from './PrivacyPolicy';
import { useAuth } from '../contexts/AuthContext';

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
  
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        await login(credentials);
      } else {
        await handleRegistration();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'operazione');
    }
  };

  const handleRegistration = async () => {
    try {
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
      await register({
        email: registrationData.email,
        password: registrationData.password,
        full_name: `${registrationData.firstName} ${registrationData.lastName}`,
        role: 'client'
      });
      
      // Mostra messaggio di successo
      setSuccess('Registrazione completata con successo! Ora puoi effettuare il login.');
      
      // Mostra toast di notifica
      setTimeout(() => {
        setSuccess('');
      }, 3000);
      
      // Reset del form di registrazione
      setRegistrationData({
        firstName: '',
        lastName: '',
        phone: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      setPrivacyAccepted(false);
      
    } catch (error) {
      throw error; // Rilancia l'errore per essere gestito da handleSubmit
    }
  };

  const handleDemoLogin = (role: 'admin' | 'barber' | 'client') => {
    const demoCredentials = {
      admin: { email: 'admin@barbershop.com', password: 'password' },
      barber: { email: 'barbiere@barbershop.com', password: 'password' },
      client: { email: 'cliente@example.com', password: 'password' },
    };
    
    setCredentials(demoCredentials[role]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-green-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Pattern di sfondo */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="barbershop-pattern" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              {/* Linee diagonali */}
              <line x1="0" y1="0" x2="60" y2="60" stroke="currentColor" strokeWidth="2" className="text-white"/>
              <line x1="60" y1="0" x2="0" y2="60" stroke="currentColor" strokeWidth="2" className="text-white"/>
              {/* Cerchi decorativi */}
              <circle cx="30" cy="30" r="3" fill="currentColor" className="text-white"/>
              <circle cx="0" cy="0" r="2" fill="currentColor" className="text-white"/>
              <circle cx="60" cy="60" r="2" fill="currentColor" className="text-white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#barbershop-pattern)"/>
        </svg>
      </div>
      
      {/* Overlay sfumato */}
      <div className="absolute inset-0 bg-gradient-to-t from-green-950/30 via-transparent to-green-950/30"></div>
      
      {/* Card principale - sopra il pattern */}
      <Card className="w-full max-w-md p-8 bg-green-500 border border-green-600 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4">
            <img 
              src="/Logo retro barbershop glass copy copy.png" 
              alt="Poltrona Logo" 
              className="w-full h-full object-contain filter brightness-110"
            />
          </div>
          <h1 className="text-2xl font-bold text-green-900">Poltrona</h1>
          <p className="text-green-800 mt-2">
            {mode === 'login' ? 'Accedi al tuo account' : 'Crea il tuo account'}
          </p>
        </div>

        {/* Nessun toggle: default login. Link sotto il tasto principale */}

        <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
          {mode === 'login' ? (
            // Form Login
            <>
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-600 text-sm">{error}</p>
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

      {/* Privacy Policy Modal */}
      <PrivacyPolicy 
        isOpen={showPrivacyPolicy} 
        onClose={() => setShowPrivacyPolicy(false)} 
      />
    </div>
  );
};
