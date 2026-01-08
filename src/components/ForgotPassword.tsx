import React, { useState } from 'react';
import { Mail, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { useTheme } from '../contexts/ThemeContext';

interface ForgotPasswordProps {
  onBack?: () => void;
  onSuccess?: () => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBack, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const { resetPasswordRequest } = useAuth();
  const { showToast } = useToast();
  const { palette } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await resetPasswordRequest(email);
      setIsSuccess(true);
      showToast('Email di recupero inviata! Controlla la tua casella di posta.', 'success');

      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore durante l\'invio dell\'email di recupero';
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
              <h1 className="text-2xl font-bold text-green-900 mb-2">Email inviata!</h1>
              <p className="text-green-800">
                Ti abbiamo inviato un'email con le istruzioni per reimpostare la tua password.
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                <strong>📧 Controlla la tua email</strong>
                <br />
                Se non trovi l'email nella posta in arrivo, controlla anche la cartella <strong>spam</strong>.
              </p>
            </div>
            {onBack && (
              <Button
                variant="secondary"
                onClick={() => {
                  // Salva messaggio di successo per mostrarlo nella pagina login
                  localStorage.setItem('password_reset_success', 'Email di recupero password inviata! Controlla la tua casella di posta.');
                  onBack();
                }}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Torna al login
              </Button>
            )}
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
            <Mail className="w-8 h-8 text-yellow-600" />
          </div>
          <h1 className="text-2xl font-bold text-green-900">Recupera Password</h1>
          <p className="text-green-800 mt-2">
            Inserisci la tua email e ti invieremo un link per reimpostare la password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Inserisci la tua email"
              autoComplete="email"
              required
            />
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

          <div className="space-y-3">
            <Button
              type="submit"
              className="w-full"
              loading={isLoading}
              disabled={isLoading}
            >
              Invia email di recupero
            </Button>

            {onBack && (
              <Button
                type="button"
                variant="secondary"
                onClick={onBack}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Torna al login
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
};
