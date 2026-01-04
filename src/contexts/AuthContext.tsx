import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, AuthState, LoginCredentials, RegisterData, UserRole } from '../types/auth';
import { API_CONFIG, API_ENDPOINTS } from '../config/api';
import { emailNotificationService } from '../services/emailNotificationService';
import { apiService } from '../services/api';
import { buildShopUrl, extractSlugFromLocation } from '../utils/slug';

interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  register: (data: RegisterData, options?: { shopSlug?: string }) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPasswordRequest: (email: string) => Promise<void>;
  resetPasswordConfirm: (token: string, newPassword: string) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  refreshSession: () => Promise<boolean>;
  isPlatformAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isSupabaseConfigured = (): boolean => {
  return Boolean(API_CONFIG.SUPABASE_EDGE_URL && API_CONFIG.SUPABASE_ANON_KEY);
};

const getShopSlugFromUrl = (): string | null => extractSlugFromLocation();

// Helper functions per gestire storage in base a rememberMe
const getStorage = (rememberMe: boolean = true): Storage => {
  return rememberMe ? localStorage : sessionStorage;
};

const saveAuthData = (
  user: User,
  accessToken: string,
  refreshToken: string | undefined,
  rememberMe: boolean = true
): void => {
  const storage = getStorage(rememberMe);
  storage.setItem('auth_user', JSON.stringify(user));
  storage.setItem('auth_token', accessToken);
  if (refreshToken) {
    storage.setItem('refresh_token', refreshToken);
  }
  if (user.shop_id) {
    storage.setItem('current_shop_id', user.shop_id);
  }
};

const loadAuthData = (): {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  rememberMe: boolean;
} => {
  // Controlla prima localStorage (rememberMe = true)
  const localUser = localStorage.getItem('auth_user');
  const localToken = localStorage.getItem('auth_token');
  const localRefreshToken = localStorage.getItem('refresh_token');
  
  if (localUser && localToken) {
    return {
      user: JSON.parse(localUser),
      accessToken: localToken,
      refreshToken: localRefreshToken,
      rememberMe: true,
    };
  }
  
  // Se non trovato in localStorage, controlla sessionStorage (rememberMe = false)
  const sessionUser = sessionStorage.getItem('auth_user');
  const sessionToken = sessionStorage.getItem('auth_token');
  const sessionRefreshToken = sessionStorage.getItem('refresh_token');
  
  if (sessionUser && sessionToken) {
    return {
      user: JSON.parse(sessionUser),
      accessToken: sessionToken,
      refreshToken: sessionRefreshToken,
      rememberMe: false,
    };
  }
  
  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    rememberMe: true,
  };
};

const clearAuthData = (): void => {
  // Rimuove da entrambi gli storage
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('current_shop_id');
  
  sessionStorage.removeItem('auth_user');
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('refresh_token');
  sessionStorage.removeItem('current_shop_id');
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
  const verifyToken = async (token: string): Promise<boolean> => {
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

  // Gestisce il callback OAuth quando l'app viene caricata con i parametri OAuth nell'URL
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Controlla se ci sono parametri OAuth nell'URL (hash o query params)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const queryParams = new URLSearchParams(window.location.search);
      
      const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
      const error = hashParams.get('error') || queryParams.get('error');
      const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');

      if (error) {
        console.error('❌ Errore OAuth:', error, errorDescription);
        setAuthState(prev => ({ ...prev, isLoading: false }));
        // Rimuovi i parametri dall'URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (accessToken && refreshToken) {
        try {
          setAuthState(prev => ({ ...prev, isLoading: true }));
          
          // Ottieni i dati dell'utente
          const userRes = await fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/user`, {
            headers: {
              'apikey': API_CONFIG.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${accessToken}`,
            }
          });

          if (!userRes.ok) {
            throw new Error('Impossibile recuperare i dati utente');
          }

          const authUser = await userRes.json();
          const authUserId = authUser.id;
          const userEmail = authUser.email;
          const userMetadata = authUser.user_metadata || {};
          
          // Estrai i dati da Google
          const fullName = userMetadata.full_name || userMetadata.name || userEmail?.split('@')[0] || 'Cliente';
          const avatarUrl = userMetadata.avatar_url || userMetadata.picture || null;

          // Fetch o crea profilo
          let profile: User | undefined;
          const profileRes = await fetch(`${API_ENDPOINTS.PROFILES}?select=*&user_id=eq.${authUserId}`, {
            headers: {
              'apikey': API_CONFIG.SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${accessToken}`,
            }
          });

          if (profileRes.ok) {
            const profiles = await profileRes.json();
            profile = profiles[0] as User | undefined;
          }

          // Risolvi shop slug (serve sia per creare profilo che per User)
          const effectiveShopSlug = getShopSlugFromUrl() || 'retro-barbershop';
          let resolvedShopId: string | null = null;
          
          if (effectiveShopSlug) {
            try {
              const shop = await apiService.getShopBySlug(effectiveShopSlug);
              resolvedShopId = shop.id;
            } catch (e) {
            }
          }
          
          if (!resolvedShopId) {
            const stored = localStorage.getItem('current_shop_id');
            if (stored) resolvedShopId = stored;
          }

          // Se il profilo non esiste, verifica se esiste staff collegato prima di crearlo
          if (!profile) {
            // Verifica se esiste uno staff con questo user_id
            let initialRole: UserRole = 'client';
            try {
              const staffCheckRes = await fetch(`${API_ENDPOINTS.STAFF}?user_id=eq.${authUserId}&select=id&limit=1`, {
                headers: {
                  'apikey': API_CONFIG.SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${accessToken}`,
                }
              });
              
              if (staffCheckRes.ok) {
                const staffRecords = await staffCheckRes.json();
                if (staffRecords && staffRecords.length > 0) {
                  // Esiste uno staff collegato, crea il profilo come 'barber'
                  initialRole = 'barber';
                }
              }
            } catch (staffError) {
              // Se la verifica fallisce, usa 'client' come default
              console.warn('⚠️ Impossibile verificare staff esistente durante OAuth:', staffError);
            }

            // Crea il profilo tramite API
            const createProfileRes = await fetch(API_ENDPOINTS.PROFILES, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': API_CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                user_id: authUserId,
                full_name: fullName,
                role: initialRole,
                shop_id: resolvedShopId,
                is_platform_admin: false,
              })
            });

            if (createProfileRes.ok) {
              const newProfile = await createProfileRes.json();
              profile = newProfile[0] || {
                id: authUserId,
                user_id: authUserId,
                full_name: fullName,
                role: initialRole,
                shop_id: resolvedShopId,
                is_platform_admin: false,
              };
            } else {
              // Se la creazione fallisce, usa dati di base
              profile = {
                id: authUserId,
                email: userEmail,
                full_name: fullName,
                role: initialRole,
                shop_id: resolvedShopId,
                is_platform_admin: false,
                created_at: new Date().toISOString(),
              };
            }

          }

          // Crea o aggiorna il record client (sia per nuovo che esistente)
          try {
            await apiService.getOrCreateClientFromUser(
              {
                id: authUserId,
                email: userEmail,
                full_name: fullName,
                phone: undefined, // Telefono opzionale per OAuth
              },
              { accessToken }
            );
            
            // Se c'è una foto profilo da Google, aggiorna il cliente
            if (avatarUrl) {
              try {
                await apiService.updateClientByEmail(userEmail, {
                  first_name: fullName.split(' ')[0] || 'Cliente',
                  last_name: fullName.split(' ').slice(1).join(' ') || null,
                  photo_url: avatarUrl,
                });
              } catch (photoError) {
              }
            }
          } catch (clientError) {
          }

          // Salva il consenso privacy per utenti OAuth
          const privacyConsent = {
            accepted: true,
            acceptedAt: new Date().toISOString(),
            version: '2.0',
          };

          // Salva nel localStorage come RegisteredClient
          const registeredClient = {
            id: authUserId,
            full_name: fullName,
            email: userEmail,
            phone: undefined,
            role: 'client' as UserRole,
            created_at: new Date().toISOString(),
            privacyConsent,
          };

          // Salva nel localStorage (compatibile con useClientRegistration)
          try {
            const existingClients = localStorage.getItem('registered_clients');
            const clients: any[] = existingClients ? JSON.parse(existingClients) : [];
            const existingIndex = clients.findIndex(c => c.email?.toLowerCase() === userEmail?.toLowerCase());
            if (existingIndex >= 0) {
              clients[existingIndex] = registeredClient;
            } else {
              clients.push(registeredClient);
            }
            localStorage.setItem('registered_clients', JSON.stringify(clients));
          } catch (storageError) {
          }

          // Crea l'oggetto User per lo stato
          const user: User = {
            id: authUserId,
            email: userEmail,
            full_name: profile?.full_name || fullName,
            role: (profile?.role as UserRole) || 'client',
            shop_id: profile?.shop_id || resolvedShopId,
            is_platform_admin: profile?.is_platform_admin || false,
            created_at: profile?.created_at || new Date().toISOString(),
          };

          // Aggiorna lo stato
          setAuthState({ user, isAuthenticated: true, isLoading: false });
          // OAuth usa sempre localStorage (rememberMe = true) per default
          saveAuthData(user, accessToken, refreshToken, true);

          // Rimuovi i parametri OAuth dall'URL
          window.history.replaceState({}, document.title, window.location.pathname);

          // Invia email di benvenuto se necessario
          try {
            const shop = await apiService.getShop();
            if (shop && userEmail) {
              const portalUrl = typeof window !== 'undefined' && window.location?.origin
                ? buildShopUrl(shop?.slug || '')
                : undefined;

              await emailNotificationService.sendClientWelcomeEmail({
                clientName: fullName,
                clientEmail: userEmail,
                shopName: shop?.name || 'Abruzzo.AI',
                portalUrl,
                supportEmail: shop?.notification_email || 'info@abruzzo.ai',
              });
            }
          } catch (emailError) {
          }

        } catch (error) {
          console.error('❌ Errore durante il callback OAuth:', error);
          setAuthState(prev => ({ ...prev, isLoading: false }));
          // Rimuovi i parametri dall'URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    };

    handleOAuthCallback();
  }, []);

  useEffect(() => {
    // Check for stored auth on mount and verify/refresh token
    const initAuth = async () => {
      const { user, accessToken, refreshToken, rememberMe } = loadAuthData();
      
      if (user && accessToken) {
        try {
          // Verifica se il token è ancora valido
          const isTokenValid = await verifyToken(accessToken);
          
          if (isTokenValid) {
            // Token valido, ricarica il profilo dal database per avere il ruolo aggiornato
            try {
              const profileRes = await fetch(`${API_ENDPOINTS.PROFILES}?select=*&user_id=eq.${user.id}`, {
                headers: {
                  'apikey': API_CONFIG.SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${accessToken}`,
                }
              });

              if (profileRes.ok) {
                const profiles = await profileRes.json();
                const profile = profiles[0] as User | undefined;
                
                if (profile) {
                  // Aggiorna l'utente con i dati freschi dal database
                  const updatedUser: User = {
                    id: user.id,
                    email: user.email,
                    full_name: (profile as any).full_name ?? user.full_name,
                    role: (profile as any).role ?? user.role,
                    shop_id: (profile as any).shop_id ?? user.shop_id,
                    is_platform_admin: (profile as any).is_platform_admin ?? user.is_platform_admin,
                    created_at: (profile as any).created_at ?? user.created_at,
                  };
                  
                  // Salva l'utente aggiornato nello storage
                  const storage = getStorage(rememberMe);
                  storage.setItem('auth_user', JSON.stringify(updatedUser));
                  
                  setAuthState({
                    user: updatedUser,
                    isAuthenticated: true,
                    isLoading: false,
                  });
                  
                  if (updatedUser.shop_id) {
                    storage.setItem('current_shop_id', updatedUser.shop_id);
                  }
                } else {
                  // Profilo non trovato, usa i dati salvati
                  setAuthState({
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                  });
                  const storage = getStorage(rememberMe);
                  if (user.shop_id) {
                    storage.setItem('current_shop_id', user.shop_id);
                  }
                }
              } else {
                // Errore nel caricamento profilo, usa i dati salvati
                setAuthState({
                  user,
                  isAuthenticated: true,
                  isLoading: false,
                });
                const storage = getStorage(rememberMe);
                if (user.shop_id) {
                  storage.setItem('current_shop_id', user.shop_id);
                }
              }
            } catch (profileError) {
              // Errore nel caricamento profilo, usa i dati salvati
              console.warn('⚠️ Impossibile ricaricare profilo dal database, uso dati salvati:', profileError);
              setAuthState({
                user,
                isAuthenticated: true,
                isLoading: false,
              });
              const storage = getStorage(rememberMe);
              if (user.shop_id) {
                storage.setItem('current_shop_id', user.shop_id);
              }
            }
          } else if (refreshToken) {
            // Token scaduto, prova a refresharlo
            
            const refreshUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/token?grant_type=refresh_token`;
            const refreshRes = await fetch(refreshUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': API_CONFIG.SUPABASE_ANON_KEY,
              },
              body: JSON.stringify({ refresh_token: refreshToken })
            });

            if (refreshRes.ok) {
              const tokenJson = await refreshRes.json();
              const newAccessToken = tokenJson.access_token;
              const storage = getStorage(rememberMe);
              storage.setItem('auth_token', newAccessToken);
              if (tokenJson.refresh_token) {
                storage.setItem('refresh_token', tokenJson.refresh_token);
              }
              
              // Ricarica il profilo dal database con il nuovo token
              try {
                const profileRes = await fetch(`${API_ENDPOINTS.PROFILES}?select=*&user_id=eq.${user.id}`, {
                  headers: {
                    'apikey': API_CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${newAccessToken}`,
                  }
                });

                if (profileRes.ok) {
                  const profiles = await profileRes.json();
                  const profile = profiles[0] as User | undefined;
                  
                  if (profile) {
                    const updatedUser: User = {
                      id: user.id,
                      email: user.email,
                      full_name: (profile as any).full_name ?? user.full_name,
                      role: (profile as any).role ?? user.role,
                      shop_id: (profile as any).shop_id ?? user.shop_id,
                      is_platform_admin: (profile as any).is_platform_admin ?? user.is_platform_admin,
                      created_at: (profile as any).created_at ?? user.created_at,
                    };
                    
                    storage.setItem('auth_user', JSON.stringify(updatedUser));
                    
                    setAuthState({
                      user: updatedUser,
                      isAuthenticated: true,
                      isLoading: false,
                    });
                    
                    if (updatedUser.shop_id) {
                      storage.setItem('current_shop_id', updatedUser.shop_id);
                    }
                  } else {
                    setAuthState({
                      user,
                      isAuthenticated: true,
                      isLoading: false,
                    });
                    if (user.shop_id) {
                      storage.setItem('current_shop_id', user.shop_id);
                    }
                  }
                } else {
                  setAuthState({
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                  });
                  if (user.shop_id) {
                    storage.setItem('current_shop_id', user.shop_id);
                  }
                }
              } catch (profileError) {
                console.warn('⚠️ Impossibile ricaricare profilo dopo refresh token:', profileError);
                setAuthState({
                  user,
                  isAuthenticated: true,
                  isLoading: false,
                });
                if (user.shop_id) {
                  storage.setItem('current_shop_id', user.shop_id);
                }
              }
            } else {
              // Refresh fallito, forza logout
              clearAuthData();
              setAuthState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
            }
          } else {
            // Nessun refresh token, forza logout
            clearAuthData();
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        } catch (error) {
          clearAuthData();
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
      clearAuthData();
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
        let errorCode = '';
        
        try {
          const maybeJson = await tokenRes.clone().json();
          serverMsg = maybeJson?.error_description || maybeJson?.msg || maybeJson?.message || serverMsg;
          errorCode = maybeJson?.error || '';
        } catch {
          try {
            const errText = await tokenRes.text();
            serverMsg = errText || serverMsg;
          } catch {}
        }
        
        // Interpreta gli errori di Supabase per dare messaggi più chiari all'utente
        const errorLower = serverMsg.toLowerCase();
        const codeLower = errorCode.toLowerCase();
        
        // Password sbagliata
        if (errorLower.includes('invalid login') || 
            errorLower.includes('invalid credentials') || 
            errorLower.includes('wrong password') ||
            errorLower.includes('incorrect password') ||
            errorLower.includes('password') ||
            codeLower.includes('invalid_credentials') ||
            codeLower.includes('invalid_grant') ||
            (errorLower.includes('invalid') && errorLower.includes('credential'))) {
          serverMsg = 'Password errata. Controlla la password e riprova.';
        }
        // Email non trovata o utente non esiste
        else if (errorLower.includes('user not found') ||
                 errorLower.includes('email not found') ||
                 errorLower.includes('no user') ||
                 codeLower.includes('user_not_found')) {
          serverMsg = 'Email non trovata. Verifica l\'indirizzo email e riprova.';
        }
        // Email non confermata
        else if (errorLower.includes('email not confirmed') ||
                 errorLower.includes('email_not_confirmed') ||
                 errorLower.includes('signup_disabled')) {
          serverMsg = 'Account non confermato. Controlla la tua email e clicca sul link di conferma.';
        }
        // Troppi tentativi
        else if (errorLower.includes('too many requests') ||
                 errorLower.includes('rate limit')) {
          serverMsg = 'Troppi tentativi di accesso. Attendi qualche minuto e riprova.';
        }
        // Errore generico di autenticazione
        else if (tokenRes.status === 400 || tokenRes.status === 401) {
          serverMsg = 'Credenziali non valide. Verifica email e password.';
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

      const shopId = (profile as any).shop_id ?? null;
      const user: User = {
        id: authUserId,
        email: credentials.email,
        full_name: (profile as any).full_name ?? '',
        role: (profile as any).role ?? 'client',
        shop_id: shopId,
        is_platform_admin: (profile as any).is_platform_admin ?? false,
        created_at: new Date().toISOString(),
      };

      setAuthState({ user, isAuthenticated: true, isLoading: false });
      // Usa rememberMe dalle credenziali (default: true)
      const rememberMe = credentials.rememberMe !== false;
      saveAuthData(user, accessToken, tokenJson.refresh_token, rememberMe);
      
      if (shopId) {
        try {
          await apiService.getShopById(shopId);
        } catch (shopErr) {
        }
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
    clearAuthData();
  };

  // Funzione per refreshare la sessione usando il refresh token
  const refreshSession = async (): Promise<boolean> => {
    const { user, refreshToken, rememberMe } = loadAuthData();
    
    if (!refreshToken || !user || !isSupabaseConfigured()) {
      return false;
    }

    try {
      
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
        return false;
      }

      const tokenJson = await refreshRes.json();
      const newAccessToken = tokenJson.access_token;
      const newRefreshToken = tokenJson.refresh_token;

      if (newAccessToken) {
        const storage = getStorage(rememberMe);
        storage.setItem('auth_token', newAccessToken);
        if (newRefreshToken) {
          storage.setItem('refresh_token', newRefreshToken);
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Errore durante il refresh della sessione:', error);
      return false;
    }
  };

  const register = async (data: RegisterData, options?: { shopSlug?: string }): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    if (!isSupabaseConfigured()) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Supabase non configurato');
    }

    try {
      // IMPORTANTE: Tutti i nuovi utenti sono SEMPRE clienti (in questo flusso)
      const forcedRole: UserRole = 'client';

      // Risolvi shop in base a query param o opzione
      let resolvedShopId: string | null = null;
      const slugFromOptions = options?.shopSlug || getShopSlugFromUrl();
      // IMPORTANTE: Se non c'è slug nell'URL, usa 'retro-barbershop' come default
      // (questo gestisce il caso del redirect temporaneo da poltrona.abruzzo.ai)
      const effectiveShopSlug = slugFromOptions || 'retro-barbershop';
      
      if (effectiveShopSlug) {
        try {
          const shop = await apiService.getShopBySlug(effectiveShopSlug);
          resolvedShopId = shop.id;
        } catch (e) {
        }
      }
      if (!resolvedShopId) {
        const stored = localStorage.getItem('current_shop_id');
        if (stored) resolvedShopId = stored;
      }
      
      // Crea l'utente in Supabase Auth
      // IMPORTANTE: Passa shop_slug nei metadati così il trigger SQL può assegnare lo shop_id corretto
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
            role: forcedRole,  // Sempre 'client' per tutti i nuovi utenti
            shop_slug: effectiveShopSlug  // IMPORTANTE: Passa lo shop_slug per il trigger SQL
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
      } catch (clientError) {
        // Non bloccare la registrazione se la creazione client fallisce
      }

      // Aggiorna il profilo con lo shop_id risolto
      try {
        if (signupJson.user?.id && resolvedShopId) {
          await apiService.updateProfileShop(signupJson.user.id, resolvedShopId);
        }
        if (resolvedShopId) {
          localStorage.setItem('current_shop_id', resolvedShopId);
        }
      } catch (profileShopError) {
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
          } else {
          }
        } else {
        }
        
        if (data.email) {
          const portalUrl = typeof window !== 'undefined' && window.location?.origin
            ? buildShopUrl(shop?.slug || '')
            : undefined;

          const welcomeResult = await emailNotificationService.sendClientWelcomeEmail({
            clientName: data.full_name,
            clientEmail: data.email,
            shopName: shop?.name || 'Abruzzo.AI',
            portalUrl,
            supportEmail: shop?.notification_email || 'info@abruzzo.ai',
          });

          if (welcomeResult.success) {
          } else {
          }
        }
        
        // Nota: Le notifiche in-app vengono create automaticamente dal trigger del database
        // quando viene creato un nuovo utente in auth.users (vedi sql/triggers.sql)
        // Non è necessario crearle manualmente qui per evitare duplicati
        
      } catch (emailError) {
        // Non bloccare la registrazione se l'email fallisce
      }
      
      // Non facciamo login automatico, l'utente deve confermare l'email se necessario
      
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error instanceof Error ? error : new Error('Errore durante la registrazione');
    }
  };

  const signInWithGoogle = async (): Promise<void> => {
    setAuthState(prev => ({ ...prev, isLoading: true }));

    if (!isSupabaseConfigured()) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw new Error('Supabase non configurato');
    }

    try {
      // Risolvi shop slug per passarlo come parametro
      const effectiveShopSlug = getShopSlugFromUrl() || 'retro-barbershop';
      
      // Costruisci l'URL di redirect (dove Google reindirizzerà dopo l'autenticazione)
      // Usa sempre l'URL corrente della pagina per garantire il redirect corretto
      // In produzione sarà https://poltrona.abruzzo.ai/[path], in sviluppo sarà localhost
      const currentUrl = window.location.href;
      // Rimuovi eventuali parametri query o hash esistenti per avere un URL pulito
      const urlObj = new URL(currentUrl);
      const redirectUrl = `${urlObj.origin}${urlObj.pathname}`;
      
      
      // URL per iniziare il flusso OAuth con Google
      // Supabase gestirà il redirect a Google e poi il callback
      const authUrl = new URL(`${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/authorize`);
      authUrl.searchParams.set('provider', 'google');
      authUrl.searchParams.set('redirect_to', redirectUrl);
      
      // Aggiungi shop_slug come parametro extra per il callback
      if (effectiveShopSlug) {
        authUrl.searchParams.set('data', JSON.stringify({ shop_slug: effectiveShopSlug }));
      }


      // Reindirizza a Google OAuth
      window.location.href = authUrl.toString();
      
      // Nota: Il flusso continuerà nel callback OAuth gestito dal useEffect sopra
      // Non impostiamo isLoading a false qui perché il redirect avviene immediatamente
    } catch (error) {
      setAuthState(prev => ({ ...prev, isLoading: false }));
      throw error instanceof Error ? error : new Error('Errore durante l\'autenticazione Google');
    }
  };

  const resetPasswordRequest = async (email: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase non configurato');
    }

    try {
      // Costruisci l'URL di redirect per il reset password
      const redirectUrl = `${window.location.origin}?token={token}&type=recovery`;

      const response = await fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'apikey': API_CONFIG.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          redirect_to: redirectUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.msg || errorData?.message || 'Errore durante la richiesta di reset password';
        throw new Error(errorMessage);
      }

      // Supabase invierà l'email anche se l'email non esiste (per sicurezza)
      // Non riveliamo se l'email esiste o meno
    } catch (error) {
      console.error('❌ Errore richiesta reset password:', error);
      throw error instanceof Error ? error : new Error('Errore durante la richiesta di reset password');
    }
  };

  const resetPasswordConfirm = async (token: string, newPassword: string): Promise<void> => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase non configurato');
    }

    try {
      // Step 1: Verifica il token di recovery
      const verifyResponse = await fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/verify`, {
        method: 'POST',
        headers: {
          'apikey': API_CONFIG.SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          type: 'recovery',
        }),
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}));
        const errorMessage = errorData?.msg || errorData?.message || 'Token non valido o scaduto';
        throw new Error(errorMessage);
      }

      const verifyData = await verifyResponse.json();
      const accessToken = verifyData.access_token;

      if (!accessToken) {
        throw new Error('Token di accesso non ricevuto');
      }

      // Step 2: Aggiorna la password usando il token di accesso
      const updateResponse = await fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'apikey': API_CONFIG.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: newPassword,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        const errorMessage = errorData?.msg || errorData?.message || 'Errore durante l\'aggiornamento della password';
        throw new Error(errorMessage);
      }

      // Step 3: Login automatico con le nuove credenziali
      const userData = await updateResponse.json();
      const userEmail = userData.email;

      if (!userEmail) {
        throw new Error('Email non trovata nei dati utente');
      }

      // Effettua il login con email e nuova password
      await login({
        email: userEmail,
        password: newPassword,
      });

    } catch (error) {
      console.error('❌ Errore conferma reset password:', error);
      throw error instanceof Error ? error : new Error('Errore durante la conferma del reset password');
    }
  };

  const isPlatformAdmin = (): boolean => {
    return authState.user?.is_platform_admin === true;
  };

  const hasPermission = (permission: string): boolean => {
    if (!authState.user) return false;
    
    // Platform Admin ha accesso a tutto
    if (isPlatformAdmin()) return true;
    
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
        return role === 'admin' || role === 'client'; // Clienti possono vedere in sola lettura
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
    signInWithGoogle,
    resetPasswordRequest,
    resetPasswordConfirm,
    hasPermission,
    refreshSession,
    isPlatformAdmin,
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
