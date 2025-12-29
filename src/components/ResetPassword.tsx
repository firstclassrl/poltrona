import React, { useState, useEffect } from 'react';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';

export const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const { resetPasswordConfirm } = useAuth();
  const { showToast } = useToast();
  const { palette } = useTheme();

  useEffect(() => {
    // Estrai token e type dai query params
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    const type = params.get('type');

    // Verifica che sia un token di recovery
    if (urlToken && type === 'recovery') {
      setToken(urlToken);
    } else {
      setError('Link di recupero non valido o scaduto. Richiedi un nuovo link.');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validazione
    if (password.length < 6) {
      setError('La password deve contenere almeno 6 caratteri');
      return;
    }

    if (password !== confirmPassword) {
      setError('Le password non coincidono');
      return;
    }

    if (!token) {
      setError('Token non valido. Richiedi un nuovo link di recupero.');
      return;
    }

    setIsLoading(true);

    try {
      await resetPasswordConfirm(token, password);
      setIsSuccess(true);
      showToast('Password reimpostata con successo!', 'success');
      
      // Redirect dopo 2 secondi
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore durante il reset della password';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Colori per lo sfondo: più scuro (primaryStrong) e più chiaro (primary) per la texture
  const bgColor = palette?.colors.primaryStrong || '#1b3015';
  const bgColorMid = palette?.colors.primary || '#25401c';

  if (isSuccess) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden login-liquid"
        style={{
          background: `linear-gradient(to bottom right, ${bgColor}, ${bgColorMid}, ${bgColor})`
        }}
      >
        <div className="login-grain"></div>
        <Card className="w-full max-w-md p-8 bg-white/25 backdrop-blur-2xl border border-white/30 shadow-2xl relative z-10 login-card-glass">
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-green-900 mb-2">Password reimpostata!</h1>
              <p className="text-green-800">
                La tua password è stata reimpostata con successo. Stai per essere reindirizzato...
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden login-liquid"
      style={{
        background: `linear-gradient(to bottom right, ${bgColor}, ${bgColorMid}, ${bgColor})`
      }}
    >
      <div className="login-grain"></div>
      <Card className="w-full max-w-md p-8 bg-white/25 backdrop-blur-2xl border border-white/30 shadow-2xl relative z-10 login-card-glass">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 flex items-center justify-center">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-green-900">Reimposta Password</h1>
          <p className="text-green-800 mt-2">
            Inserisci la tua nuova password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <div className="relative">
              <Input
                label="Nuova Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Inserisci la nuova password"
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
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Conferma la nuova password"
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

          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-semibold text-sm mb-1">Errore</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            loading={isLoading}
            disabled={isLoading || !token}
          >
            Reimposta password
          </Button>
        </form>
      </Card>
    </div>
  );
};
