import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, AuthState, LoginCredentials, RegisterData } from '../types/auth';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { emailNotificationService } from '../services/emailNotificationService';
import { apiService } from '../services/api';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isSupabaseConfigured = (): boolean => {
  return Boolean(API_CONFIG.SUPABASE_EDGE_URL && API_CONFIG.SUPABASE_ANON_KEY);
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // Check for stored auth on mount
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setAuthState({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch (error) {
        localStorage.removeItem('auth_user');
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } else {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    if (!isSupabaseConfigured()) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Supabase non configurato');
    }

    try {
      // Password grant (GoTrue)
      const tokenUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/token?grant_type=password`;
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${API_CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: credentials.email.trim().toLowerCase(), password: credentials.password })
      });

      if (!tokenRes.ok) {
        let serverMsg = 'Credenziali non valide';
        try {
          const maybeJson = await tokenRes.clone().json();
          serverMsg = maybeJson?.error_description || maybeJson?.msg || maybeJson?.message || serverMsg;
        } catch {
          try {
            const errText = await tokenRes.text();
            serverMsg = errText || serverMsg;
          } catch {}
        }
        setAuthState(prev => ({ ...prev, isLoading: false }));
        throw new Error(serverMsg);
      }

      const tokenJson = await tokenRes.json();
      const accessToken: string = tokenJson.access_token;
      const authUserId: string = tokenJson.user?.id;

      // Fetch profile to get role and details
      const profileRes = await fetch(`${API_ENDPOINTS.PROFILES}?select=*&user_id=eq.${authUserId}`, {
        headers: {
          'apikey': API_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
        }
      });

      if (!profileRes.ok) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        throw new Error('Impossibile caricare il profilo');
      }

      const profiles = await profileRes.json();
      const profile = profiles[0] as User | undefined;

      if (!profile) {
        setAuthState(prev => ({ ...prev, isLoading: false }));
        throw new Error('Profilo non trovato');
      }

      const user: User = {
        id: authUserId,
        email: credentials.email,
        full_name: (profile as any).full_name ?? '',
        role: (profile as any).role ?? 'client',
        created_at: new Date().toISOString(),
      };

      setAuthState({ user, isAuthenticated: true, isLoading: false });
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_token', accessToken);
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error instanceof Error ? error : new Error('Errore accesso');
    }
  };

  const logout = () => {
    setAuthState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    localStorage.removeItem('auth_user');
  };

  const register = async (data: RegisterData): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    if (!isSupabaseConfigured()) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Supabase non configurato');
    }

    try {
      // Crea l'utente in Supabase Auth
      const signupUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/signup`;
      const signupRes = await fetch(signupUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${API_CONFIG.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          email: data.email.trim().toLowerCase(),
          password: data.password,
          data: {
            full_name: data.full_name,
            role: data.role
          }
        })
      });

      if (!signupRes.ok) {
        let serverMsg = 'Errore durante la registrazione';
        try {
          const maybeJson = await signupRes.clone().json();
          serverMsg = maybeJson?.error_description || maybeJson?.msg || maybeJson?.message || serverMsg;
        } catch {
          try {
            const errText = await signupRes.text();
            serverMsg = errText || serverMsg;
          } catch {}
        }
        setAuthState(prev => ({ ...prev, isLoading: false }));
        throw new Error(serverMsg);
      }

      const signupJson = await signupRes.json();
      
      // Se l'utente è stato creato con successo, il trigger del database
      // dovrebbe aver creato automaticamente il profilo
      setAuthState(prev => ({ ...prev, isLoading: false }));
      
      // Invia notifica email al negozio se configurata
      try {
        const shop = await apiService.getShop();
        if (shop.notification_email) {
          const clientData = {
            clientName: data.full_name,
            clientEmail: data.email,
            clientPhone: undefined, // Non disponibile nel form di registrazione
            registrationDate: new Date().toLocaleDateString('it-IT', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            shopName: shop.name
          };

          const emailResult = await emailNotificationService.sendNewClientNotification(
            clientData, 
            shop.notification_email
          );

          if (emailResult.success) {
            console.log('✅ Email notifica inviata al negozio:', shop.notification_email);
          } else {
            console.warn('⚠️ Errore nell\'invio email notifica:', emailResult.error);
          }
        } else {
          console.log('ℹ️ Email notifica non configurata per il negozio');
        }
      } catch (emailError) {
        // Non bloccare la registrazione se l'email fallisce
        console.warn('⚠️ Errore nel recupero dati negozio o invio email:', emailError);
      }
      
      // Non facciamo login automatico, l'utente deve confermare l'email se necessario
      console.log('✅ Utente registrato con successo:', signupJson.user?.email);
      
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error instanceof Error ? error : new Error('Errore durante la registrazione');
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!authState.user) return false;
    
    const { role } = authState.user;
    
    switch (permission) {
      case 'dashboard':
        return role === 'admin' || role === 'barber'; // Clienti non vedono dashboard
      case 'appointments':
        return role === 'admin' || role === 'barber';
      case 'clients':
        return role === 'admin' || role === 'barber';
      case 'products':
        return role === 'admin' || role === 'barber' || role === 'client';
      case 'services':
        return role === 'admin' || role === 'barber';
      case 'chat':
        return role === 'admin' || role === 'barber' || role === 'client';
      // case 'analytics':
      //   return role === 'admin'; // Temporaneamente nascosto
      case 'profile':
        return role === 'admin' || role === 'barber';
      case 'shop':
        return role === 'admin';
      case 'client_profile':
        return role === 'client';
      case 'client_booking':
        return role === 'client';
      default:
        return false;
    }
  };

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    register,
    hasPermission,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
