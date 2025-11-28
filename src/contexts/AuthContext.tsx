import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, AuthState, LoginCredentials, RegisterData, UserRole } from '../types/auth';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { emailNotificationService } from '../services/emailNotificationService';
import { apiService } from '../services/api';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshSession: () => Promise<boolean>;
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

  // Funzione per verificare se il token è valido
  const verifyToken = async (): Promise<boolean> => {
    const token = localStorage.getItem('auth_token');
    if (!token || !isSupabaseConfigured()) return false;

    try {
      // Prova a fare una chiamata semplice per verificare il token
      const response = await fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/user`, {
        headers: {
          'apikey': API_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${token}`,
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // Check for stored auth on mount and verify/refresh token
    const initAuth = async () => {
      const storedUser = localStorage.getItem('auth_user');
      const storedToken = localStorage.getItem('auth_token');
      const storedRefreshToken = localStorage.getItem('refresh_token');
      
      if (storedUser && storedToken) {
        try {
          const user = JSON.parse(storedUser);
          
          // Verifica se il token è ancora valido
          const isTokenValid = await verifyToken();
          
          if (isTokenValid) {
            // Token valido, procedi normalmente
            setAuthState({
              user,
              isAuthenticated: true,
              isLoading: false,
            });
          } else if (storedRefreshToken) {
            // Token scaduto, prova a refresharlo
            console.log('🔄 Token scaduto, tentativo di refresh...');
            
            const refreshUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/token?grant_type=refresh_token`;
            const refreshRes = await fetch(refreshUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': API_CONFIG.SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ refresh_token: storedRefreshToken })
            });

            if (refreshRes.ok) {
              const tokenJson = await refreshRes.json();
              localStorage.setItem('auth_token', tokenJson.access_token);
              if (tokenJson.refresh_token) {
                localStorage.setItem('refresh_token', tokenJson.refresh_token);
              }
              console.log('✅ Sessione rinnovata automaticamente');
              
              setAuthState({
                user,
                isAuthenticated: true,
                isLoading: false,
              });
            } else {
              // Refresh fallito, forza logout
              console.log('❌ Refresh fallito, sessione terminata');
              localStorage.removeItem('auth_user');
              localStorage.removeItem('auth_token');
              localStorage.removeItem('refresh_token');
              setAuthState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          } else {
            // Nessun refresh token, forza logout
            console.log('❌ Token scaduto e nessun refresh token');
            localStorage.removeItem('auth_user');
            localStorage.removeItem('auth_token');
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          localStorage.removeItem('auth_user');
          localStorage.removeItem('auth_token');
          localStorage.removeItem('refresh_token');
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
    };

    initAuth();

    // Listener per sessione scaduta (inviato da api.ts quando il refresh fallisce)
    const handleSessionExpired = () => {
      console.log('🔒 Sessione scaduta, logout forzato');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      // Mostra un alert all'utente
      alert('La tua sessione è scaduta. Effettua nuovamente il login.');
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);
    
    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
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
        
        // Se l'errore indica credenziali invalide o password sbagliata, mostra messaggio specifico
        const errorLower = serverMsg.toLowerCase();
        if (errorLower.includes('invalid login') || 
            errorLower.includes('invalid credentials') || 
            errorLower.includes('wrong password') ||
            errorLower.includes('incorrect password') ||
            errorLower.includes('password') ||
            (errorLower.includes('invalid') && errorLower.includes('credential'))) {
          serverMsg = 'Password sbagliata';
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
      // Salva anche il refresh token per poter rinnovare la sessione
      if (tokenJson.refresh_token) {
        localStorage.setItem('refresh_token', tokenJson.refresh_token);
      }
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
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  };

  // Funzione per refreshare la sessione usando il refresh token
  const refreshSession = async (): Promise<boolean> => {
    const refreshToken = localStorage.getItem('refresh_token');
    const storedUser = localStorage.getItem('auth_user');
    
    if (!refreshToken || !storedUser || !isSupabaseConfigured()) {
      console.log('🔄 Refresh session: dati mancanti, logout richiesto');
      return false;
    }

    try {
      console.log('🔄 Tentativo di refresh della sessione...');
      
      const refreshUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/token?grant_type=refresh_token`;
      const refreshRes = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (!refreshRes.ok) {
        console.log('❌ Refresh fallito, sessione scaduta');
        return false;
      }

      const tokenJson = await refreshRes.json();
      const newAccessToken = tokenJson.access_token;
      const newRefreshToken = tokenJson.refresh_token;

      if (newAccessToken) {
        localStorage.setItem('auth_token', newAccessToken);
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken);
        }
        console.log('✅ Sessione rinnovata con successo');
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Errore durante il refresh della sessione:', error);
      return false;
    }
  };

  const register = async (data: RegisterData): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    if (!isSupabaseConfigured()) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Supabase non configurato');
    }

    try {
      // IMPORTANTE: Tutti i nuovi utenti sono SEMPRE clienti
      // Il ruolo viene sempre impostato a 'client' indipendentemente da quello passato
      const forcedRole: UserRole = 'client';
      
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
            role: forcedRole  // Sempre 'client' per tutti i nuovi utenti
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
      let signupAccessToken: string | undefined = signupJson.session?.access_token;

      // Se Supabase non restituisce automaticamente la sessione, effettua un login silente
      if (!signupAccessToken) {
        try {
          const tokenUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/token?grant_type=password`;
          const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': API_CONFIG.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${API_CONFIG.SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ email: data.email.trim().toLowerCase(), password: data.password })
          });
          if (tokenRes.ok) {
            const tokenJson = await tokenRes.json();
            signupAccessToken = tokenJson.access_token;
          }
        } catch (silentLoginError) {
          console.warn('⚠️ Login silente fallito per creazione client:', silentLoginError);
        }
      }
      
      // Se l'utente è stato creato con successo, crea anche il record client
      // per far apparire l'utente nella pagina Clienti
      try {
        await apiService.getOrCreateClientFromUser(
          {
            id: signupJson.user?.id || '',
            email: data.email,
            full_name: data.full_name,
            phone: data.phone || undefined,
          },
          { accessToken: signupAccessToken }
        );
        console.log('✅ Record client creato per:', data.email);
      } catch (clientError) {
        console.warn('⚠️ Errore nella creazione del record client:', clientError);
        // Non bloccare la registrazione se la creazione client fallisce
      }
      
      setAuthState(prev => ({ ...prev, isLoading: false }));
      
      // Invia notifica email al negozio se configurata
      try {
        const shop = await apiService.getShop();
        if (shop.notification_email) {
          const clientData = {
            clientName: data.full_name,
            clientEmail: data.email,
            clientPhone: data.phone || undefined,
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
        
        if (data.email) {
          const portalUrl = typeof window !== 'undefined' && window.location?.origin
            ? `${window.location.origin}/login`
            : undefined;

          const welcomeResult = await emailNotificationService.sendClientWelcomeEmail({
            clientName: data.full_name,
            clientEmail: data.email,
            shopName: shop?.name || 'Abruzzo.AI',
            portalUrl,
            supportEmail: shop?.notification_email || 'info@abruzzo.ai',
          });

          if (welcomeResult.success) {
            console.log('✅ Email di benvenuto inviata al cliente:', data.email);
          } else {
            console.warn('⚠️ Errore nell\'invio email di benvenuto:', welcomeResult.error);
          }
        }
        
        // Crea notifiche in-app per tutti i barbieri
        try {
          const staffList = await apiService.getStaff();
          const registrationDate = new Date().toLocaleDateString('it-IT', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          for (const staffMember of staffList) {
            if (staffMember.active) {
              await apiService.createNotification({
                user_id: staffMember.user_id || staffMember.id,
                user_type: 'staff',
                type: 'new_client',
                title: '👤 Nuovo Cliente Registrato!',
                message: `${data.full_name} si è appena registrato all'app. Email: ${data.email}`,
                data: {
                  client_name: data.full_name,
                  client_email: data.email,
                  client_phone: data.phone || '',
                  registration_date: registrationDate,
                }
              });
            }
          }
          console.log('✅ Notifiche in-app create per lo staff');
        } catch (notifError) {
          console.warn('⚠️ Errore creazione notifiche in-app:', notifError);
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
      case 'notifications':
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
      case 'client_bookings':
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
    refreshSession,
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
