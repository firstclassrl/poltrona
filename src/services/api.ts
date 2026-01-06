import { API_ENDPOINTS, API_CONFIG } from '../config/api';
import type {
  Client,
  Appointment,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  Profile,
  Staff,
  Service,
  Product,
  Shop,
  Chat,
  ChatMessage,
  CreateMessageRequest,
  CreateChatRequest,
  ShopHoursConfig,
  TimeSlot,
  ShopDailyHoursEntity,
  ShopDailyTimeSlotRow,
  Notification,
  NotificationType,
  WaitlistEntry,
  JoinWaitlistRequest,
  VacationPeriod
} from '../types';
import { createDefaultShopHoursConfig, formatTimeToHHMM, normalizeTimeString } from '../utils/shopHours';
import { extractSlugFromLocation, nextSlugCandidate, slugify } from '../utils/slug';
import { isItalianHoliday } from '../utils/italianHolidays';

// Check if Supabase is configured
const isSupabaseConfigured = () => {
  return API_CONFIG.SUPABASE_EDGE_URL && API_CONFIG.SUPABASE_ANON_KEY;
};

// Helper per verificare se l'utente è autenticato
const isAuthenticated = (): boolean => {
  // Consideriamo sempre l'utente autenticato lato dashboard; Supabase RLS farà fede
  return true;
};

// Helper per verificare se un errore è dovuto a JWT scaduto o mancante autenticazione
const isAuthError = (error: any): boolean => {
  if (!error) return false;
  const errorStr = error.toString().toLowerCase();
  const errorMessage = error?.message?.toLowerCase() || '';
  return errorStr.includes('jwt expired') ||
    errorStr.includes('jwt') ||
    errorMessage.includes('jwt expired') ||
    errorMessage.includes('401') ||
    errorMessage.includes('unauthorized');
};

// Helper per tentare il refresh del token
const tryRefreshToken = async (): Promise<boolean> => {
  // Cerca il refresh_token in entrambi gli storage (come fa buildHeaders per auth_token)
  const refreshToken = localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
  if (!refreshToken || !isSupabaseConfigured()) {
    return false;
  }

  // Determina quale storage usare (stesso storage dove è stato trovato il refresh_token)
  const useLocalStorage = localStorage.getItem('refresh_token') !== null;
  const storage = useLocalStorage ? localStorage : sessionStorage;

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

    if (refreshRes.ok) {
      const tokenJson = await refreshRes.json();
      // Salva il nuovo token nello stesso storage da cui è stato letto il refresh_token
      storage.setItem('auth_token', tokenJson.access_token);
      if (tokenJson.refresh_token) {
        storage.setItem('refresh_token', tokenJson.refresh_token);
      }
      // Assicurati che anche l'altro storage sia aggiornato se necessario
      // (per mantenere coerenza se il token era già presente in entrambi)
      if (useLocalStorage && sessionStorage.getItem('auth_token')) {
        sessionStorage.setItem('auth_token', tokenJson.access_token);
        if (tokenJson.refresh_token) {
          sessionStorage.setItem('refresh_token', tokenJson.refresh_token);
        }
      } else if (!useLocalStorage && localStorage.getItem('auth_token')) {
        localStorage.setItem('auth_token', tokenJson.access_token);
        if (tokenJson.refresh_token) {
          localStorage.setItem('refresh_token', tokenJson.refresh_token);
        }
      }
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
};

// Helper per fare fetch con retry automatico se il token è scaduto
const fetchWithTokenRefresh = async (
  url: string,
  options: RequestInit,
  useAuth: boolean = true
): Promise<Response> => {
  let response = await fetch(url, options);

  // Se errore 401/403 e usaAuth, prova refresh se token scaduto o bad_jwt
  // IMPORTANTE: Tentiamo il refresh anche per errori 403 generici, perché potrebbero essere causati da token scaduto
  // che fa fallire le policy RLS (auth.uid() restituisce NULL quando il token è scaduto)
  if (useAuth && (response.status === 401 || response.status === 403)) {
    const responseText = await response.clone().text();
    const responseLower = responseText.toLowerCase();

    // Controlla se è un errore JWT esplicito
    const isJwtIssue = responseLower.includes('jwt expired') ||
      responseLower.includes('bad jwt') ||
      responseLower.includes('jwt') ||
      responseLower.includes('unauthorized');

    // Controlla se è un errore RLS che potrebbe essere causato da token scaduto
    const isRlsIssue = responseLower.includes('row-level security') ||
      responseLower.includes('violates row-level security policy') ||
      responseLower.includes('42501');

    // Tentiamo il refresh se:
    // 1. È un errore JWT esplicito
    // 2. È un errore 401 (sempre probabilmente autenticazione)
    // 3. È un errore 403 con RLS (potrebbe essere token scaduto)
    if (isJwtIssue || response.status === 401 || (response.status === 403 && isRlsIssue)) {
      const refreshed = await tryRefreshToken();

      if (refreshed) {
        // Ricostruisci gli headers con il nuovo token (cerca in entrambi gli storage)
        const newToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const newHeaders = { ...buildHeaders(true) };
        if (options.headers) {
          Object.assign(newHeaders, options.headers);
        }
        if (newToken) {
          newHeaders['Authorization'] = `Bearer ${newToken}`;
        }

        // Riprova la chiamata
        response = await fetch(url, { ...options, headers: newHeaders });
      } else {
        // Refresh fallito, forza logout
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
      }
    }
  }

  return response;
};

const buildHeaders = (authRequired: boolean = false, overrideToken?: string) => {
  // Leggi il token da localStorage O sessionStorage (come fa AuthContext)
  let storedToken: string | null = null;
  if (typeof window !== 'undefined') {
    storedToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
  }

  const bearer = authRequired
    ? (overrideToken || storedToken || API_CONFIG.SUPABASE_ANON_KEY)
    : API_CONFIG.SUPABASE_ANON_KEY;

  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'apikey': API_CONFIG.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${bearer}`,
  } as Record<string, string>;
};

const DEFAULT_SHOP_SLUG = 'retro-barbershop';

// Helper per ottenere il token di autenticazione da localStorage o sessionStorage
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
};

const getStoredShopId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('current_shop_id');
};

const getStoredShopSlug = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('current_shop_slug');
};

const getSlugFromPathOrStorage = (): string | null => {
  const slugFromUrl = extractSlugFromLocation();
  if (slugFromUrl) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('current_shop_slug', slugFromUrl);
    }
    return slugFromUrl;
  }
  const storedSlug = getStoredShopSlug();
  if (storedSlug) return storedSlug;
  return null;
};

const getEffectiveSlug = (): string => {
  return getSlugFromPathOrStorage() || DEFAULT_SHOP_SLUG;
};

const isSlugAvailable = async (slug: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) return true;
  const url = `${API_ENDPOINTS.SHOPS}?select=slug&slug=eq.${encodeURIComponent(slug)}&limit=1`;
  const response = await fetch(url, { headers: buildHeaders(false) });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Impossibile verificare disponibilità slug: ${response.status} ${text}`);
  }
  const result = await response.json();
  return !result || result.length === 0;
};

const ensureUniqueShopSlug = async (value: string): Promise<string> => {
  const baseSlug = slugify(value || DEFAULT_SHOP_SLUG);
  let attempt = 1;

  while (attempt <= 50) {
    const candidate = nextSlugCandidate(baseSlug, attempt);
    const available = await isSlugAvailable(candidate);
    if (available) return candidate;
    attempt += 1;
  }

  throw new Error('Impossibile generare uno slug univoco. Riprova con un nome differente.');
};

const persistShopLocally = (shop: Shop) => {
  if (typeof window === 'undefined' || !shop) return;
  if (shop.id) {
    localStorage.setItem('current_shop_id', shop.id);
  }
  if ((shop as any).slug) {
    localStorage.setItem('current_shop_slug', (shop as any).slug as string);
  }
};

export const apiService = {
  ensureUniqueShopSlug: (value: string) => ensureUniqueShopSlug(value),
  // Client search
  async searchClients(query: string): Promise<Client[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      // CRITICO: Aggiungi filtro esplicito shop_id come doppia sicurezza
      let shopId = getStoredShopId();
      if (!shopId) {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
      }

      // Se la query è vuota, carica tutti i clienti senza limite
      // Altrimenti, applica un limite ragionevole per le ricerche
      const limit = query.trim() === '' ? 'limit=1000' : 'limit=100';

      // Costruisci URL con filtro shop_id se disponibile
      let url = `${API_ENDPOINTS.SEARCH_CLIENTS}?select=id,first_name,last_name,phone_e164,email&or=(first_name.ilike.*${query}*,last_name.ilike.*${query}*,phone_e164.ilike.*${query}*)&order=created_at.desc&${limit}`;
      if (shopId && shopId !== 'default') {
        url += `&shop_id=eq.${shopId}`;
      }

      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) throw new Error('Failed to search clients');
      return await response.json();
    } catch (error) {
      console.error('Error searching clients:', error);
      return [];
    }
  },

  // Create new client (requires authentication)
  async createClient(data: Partial<Client> & { password?: string }, options?: { accessToken?: string }): Promise<Client> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    // Validate required fields
    if (!data.first_name?.trim()) throw new Error('Nome è obbligatorio');
    if (!data.last_name?.trim()) throw new Error('Cognome è obbligatorio');
    if (!data.phone_e164?.trim()) throw new Error('Telefono è obbligatorio');
    if (!data.email?.trim()) throw new Error('Email è obbligatoria');

    let authUserId: string | undefined;
    let authAccessToken: string | undefined;

    // If password is provided, create Auth user first
    if (data.password) {
      try {
        const fullName = `${data.first_name.trim()} ${data.last_name.trim()}`.trim();

        // Create user in Supabase Auth
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
              full_name: fullName,
              role: 'client'
            }
          })
        });

        if (!signupRes.ok) {
          let serverMsg = 'Errore durante la creazione dell\'utente';
          try {
            const maybeJson = await signupRes.clone().json();
            serverMsg = maybeJson?.error_description || maybeJson?.msg || maybeJson?.message || serverMsg;
          } catch {
            try {
              const errText = await signupRes.text();
              serverMsg = errText || serverMsg;
            } catch { }
          }

          // If user already exists, try to get existing user
          if (serverMsg.toLowerCase().includes('already registered') ||
            serverMsg.toLowerCase().includes('user already exists') ||
            signupRes.status === 422) {
            // User already exists, we'll create client record without Auth user
            // User already exists, create client record only
          } else {
            throw new Error(serverMsg);
          }
        } else {
          const signupJson = await signupRes.json();
          authUserId = signupJson.user?.id;
          authAccessToken = signupJson.session?.access_token;

          // If no session token, try silent login
          if (!authAccessToken) {
            try {
              const tokenUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/token?grant_type=password`;
              const tokenRes = await fetch(tokenUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': API_CONFIG.SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${API_CONFIG.SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                  email: data.email.trim().toLowerCase(),
                  password: data.password
                })
              });
              if (tokenRes.ok) {
                const tokenJson = await tokenRes.json();
                authAccessToken = tokenJson.access_token;
              }
            } catch (silentLoginError) {
              // Silent login failed, continue without token
            }
          }
        }
      } catch (authError) {
        console.error('Error creating Auth user:', authError);
        // If Auth creation fails but we have email, still try to create client
        // (might be duplicate email case)
      }
    }

    let shopId = getStoredShopId();
    if (!shopId || shopId === 'default') {
      try {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
      } catch (shopError) {
        console.error('Error getting shop:', shopError);
        // Se getShop() fallisce, prova a ottenere shop_id dal profilo
        const authToken = localStorage.getItem('auth_token');
        if (authToken) {
          try {
            // Decodifica JWT per ottenere user_id
            const payload = JSON.parse(atob(authToken.split('.')[1]));
            const userId = payload.sub;
            if (userId) {
              const profileUrl = `${API_ENDPOINTS.PROFILES}?user_id=eq.${userId}&select=shop_id&limit=1`;
              const profileRes = await fetch(profileUrl, { headers: buildHeaders(true) });
              if (profileRes.ok) {
                const profiles = await profileRes.json();
                if (profiles && profiles.length > 0 && profiles[0].shop_id) {
                  shopId = profiles[0].shop_id;
                }
              }
            }
          } catch (profileError) {
            console.error('❌ createClient: Errore ottenendo shop_id dal profilo:', profileError);
          }
        }
      }
    }

    if (!shopId || shopId === 'default') {
      console.error('❌ createClient: shop_id non disponibile! Impossibile creare cliente.');
      throw new Error('Impossibile determinare l\'ID del negozio. Assicurati di essere loggato correttamente.');
    }

    const payload: Partial<Client> = {
      shop_id: shopId,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      phone_e164: data.phone_e164.trim(),
      email: data.email.trim(),
      notes: data.notes || null,
    };

    try {
      // Use auth token if available, otherwise use provided token
      const accessToken = authAccessToken || options?.accessToken;

      const headers = buildHeaders(true, accessToken);

      // Usa fetchWithTokenRefresh per gestire automaticamente il refresh del token se scaduto
      const response = await fetchWithTokenRefresh(
        API_ENDPOINTS.SEARCH_CLIENTS,
        {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        },
        true // useAuth = true per abilitare il refresh automatico
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ createClient: Errore creazione cliente:', response.status, errorText);
        console.error('❌ createClient: Payload inviato:', payload);
        console.error('❌ createClient: URL:', API_ENDPOINTS.SEARCH_CLIENTS);
        throw new Error(`Failed to create client: ${response.status} ${errorText}`);
      }

      const created = await response.json();
      const newClient = created[0];

      // If we created an Auth user, ensure the client record is linked via getOrCreateClientFromUser
      // This ensures consistency with the profiles table
      if (authUserId && authAccessToken) {
        try {
          await this.getOrCreateClientFromUser(
            {
              id: authUserId,
              email: data.email.trim(),
              full_name: `${data.first_name.trim()} ${data.last_name.trim()}`.trim(),
              phone: data.phone_e164.trim(),
            },
            { accessToken: authAccessToken }
          );
        } catch (linkError) {
          // Failed to link client-user
          // Don't fail if linking fails, client is already created
        }
      }

      return newClient;
    } catch (error) {
      console.error('Error creating client:', error);
      throw error;
    }
  },

  // Update client by ID (requires authentication)
  async updateClient(clientId: string, data: Partial<Client>, options?: { accessToken?: string }): Promise<Client> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    if (!clientId) throw new Error('ID cliente mancante');

    const allowedFields: Array<keyof Client> = [
      'first_name',
      'last_name',
      'phone_e164',
      'email',
      'notes',
    ];
    const payload: Record<string, unknown> = {};
    allowedFields.forEach(field => {
      if (typeof data[field] !== 'undefined') {
        payload[field] = data[field];
      }
    });

    try {
      const response = await fetch(`${API_ENDPOINTS.SEARCH_CLIENTS}?id=eq.${clientId}`, {
        method: 'PATCH',
        headers: { ...buildHeaders(true, options?.accessToken), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update client: ${response.status} ${errorText}`);
      }

      const updated = await response.json();
      return updated[0];
    } catch (error) {
      console.error('Error updating client:', error);
      throw error;
    }
  },

  // Update or create client by email (pubblico - non richiede autenticazione)
  async updateClientByEmail(
    email: string,
    data: { first_name?: string; last_name?: string | null; phone_e164?: string; photo_url?: string | null; profile_photo_path?: string | null }
  ): Promise<void> {
    if (!isSupabaseConfigured()) {
      // Se Supabase non è configurato, non fare nulla (silent fail)
      return;
    }

    try {
      // CRITICO: Ottieni shop_id prima di cercare il cliente
      let shopId = getStoredShopId();
      if (!shopId) {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
      }

      // Prima cerca se il cliente esiste (usa accesso pubblico)
      // CRITICO: Filtra per shop_id per evitare cross-shop
      let searchUrl = `${API_ENDPOINTS.SEARCH_CLIENTS}?select=id,shop_id&email=eq.${encodeURIComponent(email)}&limit=1`;
      if (shopId && shopId !== 'default') {
        searchUrl += `&shop_id=eq.${shopId}`;
      }
      const searchResponse = await fetch(searchUrl, { headers: buildHeaders(true) });

      if (searchResponse.ok) {
        const clients = await searchResponse.json();

        if (clients && clients.length > 0) {
          const foundClient = clients[0];

          // CRITICO: Verifica che il cliente appartenga allo shop corretto
          if (shopId && shopId !== 'default' && foundClient.shop_id && foundClient.shop_id !== shopId) {
            // Cliente trovato ma appartiene a un altro shop - crea nuovo cliente per questo shop
            console.warn('⚠️ upsertClientByEmail: Cliente trovato ma appartiene a shop diverso, creo nuovo cliente');
          } else {
            // Cliente esiste e appartiene allo shop corretto - aggiorna (usa accesso pubblico)
            const clientId = foundClient.id;
            const updateResponse = await fetch(`${API_ENDPOINTS.SEARCH_CLIENTS}?id=eq.${clientId}`, {
              method: 'PATCH',
              headers: { ...buildHeaders(true), Prefer: 'return=minimal' },
              body: JSON.stringify(data),
            });

            if (updateResponse.ok) {
              // Client updated successfully
              return; // Esci dalla funzione dopo l'aggiornamento
            } else {
              // Se fallisce, non loggare come errore - potrebbe essere un problema di RLS
              // Non bloccare il flusso
            }
          }
        }

        // Cliente non esiste o appartiene a shop diverso - crealo (usa accesso pubblico)
        // shopId già ottenuto sopra
        const createData = {
          shop_id: shopId && shopId !== 'default' ? shopId : null,
          first_name: data.first_name || 'Cliente',
          last_name: data.last_name || null,
          phone_e164: data.phone_e164 || '+39000000000',
          email: email,
        };

        const createResponse = await fetch(API_ENDPOINTS.SEARCH_CLIENTS, {
          method: 'POST',
          headers: { ...buildHeaders(true), Prefer: 'return=representation' },
          body: JSON.stringify(createData),
        });

        if (createResponse.ok) {
          // Client created successfully
        } else {
          // Se fallisce, non loggare come errore - potrebbe essere un problema di RLS
          // Non bloccare il flusso
        }
      } else {
        // Se la ricerca fallisce (401, etc.), non loggare come errore
        // Potrebbe essere normale se l'utente non è autenticato e le RLS non permettono la ricerca
      }
    } catch (error) {
      // Non loggare errori - potrebbe essere normale se l'utente non è autenticato
      // Non bloccare il flusso
    }
  },

  // Recupera un cliente per email (match esatto) includendo la foto
  async getClientByEmailExact(email: string): Promise<Client | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      // CRITICO: Filtra per shop_id per evitare cross-shop
      let shopId = getStoredShopId();
      if (!shopId) {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
      }

      let url = `${API_ENDPOINTS.SEARCH_CLIENTS}?select=*&email=eq.${encodeURIComponent(email)}&limit=1`;
      if (shopId && shopId !== 'default') {
        url += `&shop_id=eq.${shopId}`;
      }
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) return null;
        throw new Error(`Failed to fetch client by email: ${response.status}`);
      }
      const clients = await response.json();
      return clients?.[0] || null;
    } catch (error) {
      console.error('Error fetching client by email:', error);
      return null;
    }
  },

  // Get or create client from authenticated user (pubblico - non richiede autenticazione)
  async getOrCreateClientFromUser(
    user: { id: string; email?: string; full_name?: string; phone?: string },
    options?: { accessToken?: string }
  ): Promise<{ id: string; email?: string | null; phone_e164?: string | null }> {
    if (!isSupabaseConfigured()) {
      // Se Supabase non è configurato, genera un ID temporaneo
      return { id: `temp_client_${Date.now()}`, email: user.email ?? null, phone_e164: user.phone ?? null };
    }

    try {
      // CRITICO: Ottieni shop_id prima di cercare il cliente
      let shopId = getStoredShopId();
      if (!shopId) {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
      }

      // Cerca se esiste già un cliente con questa email (usa accesso pubblico)
      // CRITICO: Filtra per shop_id per evitare cross-shop
      if (user.email) {
        let searchUrl = `${API_ENDPOINTS.SEARCH_CLIENTS}?select=id,email,phone_e164,shop_id&email=eq.${encodeURIComponent(user.email)}&limit=1`;
        if (shopId && shopId !== 'default') {
          searchUrl += `&shop_id=eq.${shopId}`;
        }
        const searchResponse = await fetch(searchUrl, { headers: buildHeaders(true, options?.accessToken) });

        if (searchResponse.ok) {
          const existingClients = await searchResponse.json();
          if (existingClients && existingClients.length > 0) {
            const existingClient = existingClients[0];

            // CRITICO: Verifica che il cliente appartenga allo shop corretto
            if (shopId && shopId !== 'default' && existingClient.shop_id && existingClient.shop_id !== shopId) {
              // Cliente trovato ma appartiene a un altro shop - non restituirlo
              console.warn('⚠️ Cliente trovato ma appartiene a shop diverso:', existingClient.shop_id, 'vs', shopId);
              // Continua a creare un nuovo cliente per questo shop
            } else {

              // Aggiorna il numero se manca e l'utente lo ha fornito
              if ((!existingClient.phone_e164 || existingClient.phone_e164 === '+39000000000') && user.phone) {
                try {
                  await fetch(`${API_ENDPOINTS.SEARCH_CLIENTS}?id=eq.${existingClient.id}`, {
                    method: 'PATCH',
                    headers: { ...buildHeaders(true, options?.accessToken), Prefer: 'return=representation' },
                    body: JSON.stringify({ phone_e164: user.phone }),
                  });
                  existingClient.phone_e164 = user.phone;
                } catch (updateError) {
                }
              }

              return existingClient;
            }
          }
        } else if (searchResponse.status === 401) {
          // Se è un errore 401, non continuare - l'utente non è autenticato
          throw new Error('Unauthorized: autenticazione richiesta');
        }
      }

      // Se non esiste o appartiene a shop diverso, crea un nuovo cliente (usa accesso pubblico)
      // shopId già ottenuto sopra
      const fullName = user.full_name || 'Cliente';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || 'Cliente';
      const lastName = nameParts.slice(1).join(' ') || null;

      const clientData: Partial<Client> = {
        shop_id: shopId && shopId !== 'default' ? shopId : null,
        first_name: firstName,
        last_name: lastName,
        phone_e164: user.phone || '+39000000000',
        email: user.email || null,
      };

      // Verifica che il token sia valido prima di procedere
      const tokenToUse = options?.accessToken || localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!tokenToUse) {
        throw new Error('Unauthorized: token di autenticazione mancante');
      }

      // Verifica che il token sia valido chiamando l'endpoint auth
      try {
        const verifyResponse = await fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/auth/v1/user`, {
          headers: {
            'apikey': API_CONFIG.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${tokenToUse}`,
          }
        });

        if (!verifyResponse.ok) {
          console.error('❌ Token non valido:', verifyResponse.status);
          // Prova a fare refresh del token
          const refreshed = await tryRefreshToken();
          if (!refreshed) {
            throw new Error('Unauthorized: token non valido e refresh fallito. Effettua il login di nuovo.');
          }
          // Se il refresh ha funzionato, usa il nuovo token
          const newToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
          if (newToken) {
          }
        } else {
          const userData = await verifyResponse.json();
        }
      } catch (verifyError) {
        // Continua comunque, potrebbe essere un problema temporaneo
      }

      const headers = buildHeaders(true, options?.accessToken);

      const createResponse = await fetch(API_ENDPOINTS.SEARCH_CLIENTS, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(clientData),
      });

      if (createResponse.ok) {
        const created = await createResponse.json();
        const client = created[0];
        return client;
      } else {
        const errorText = await createResponse.text();
        console.error('❌ Failed to create client:', {
          status: createResponse.status,
          statusText: createResponse.statusText,
          error: errorText,
          clientData,
        });

        // Se è un errore 401 (non autenticato), non generare ID temporaneo per evitare loop
        if (createResponse.status === 401) {
          throw new Error('Unauthorized: autenticazione richiesta');
        }
        // Per altri errori, genera un ID temporaneo (ma solo una volta)
        const tempId = `temp_client_${Date.now()}`;
        return { id: tempId, email: user.email ?? null, phone_e164: user.phone ?? null };
      }
    } catch (error) {
      // Se è un errore 401, non generare ID temporaneo per evitare loop
      if (error instanceof Error && error.message.includes('Unauthorized')) {
        throw error;
      }
      // Per altri errori, genera un ID temporaneo (ma solo una volta)
      const tempId = `temp_client_${Date.now()}`;
      return { id: tempId, email: user.email ?? null, phone_e164: user.phone ?? null };
    }
  },

  async getDailyShopHours(): Promise<ShopHoursConfig> {
    if (!isSupabaseConfigured()) {
      return createDefaultShopHoursConfig();
    }

    try {
      let shopId = getStoredShopId();

      // Se lo shop_id non è trovato o è 'default', carica lo shop dal database
      if (!shopId || shopId === 'default') {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
        // Assicurati che lo shop_id sia salvato nel localStorage
        if (shopId && shopId !== 'default') {
          localStorage.setItem('current_shop_id', shopId);
        }
      }

      // Se ancora non abbiamo uno shop_id valido, restituisci config vuota
      if (!shopId || shopId === 'default') {
        return createDefaultShopHoursConfig();
      }

      // IMPORTANTE: Usa sempre buildHeaders(true) per avere autenticazione
      // Le RLS policies filtrano per shop_id usando current_shop_id() che richiede autenticazione
      // Se non c'è autenticazione, le RLS policies potrebbero non trovare i record
      const hasAuth = !!localStorage.getItem('auth_token');
      let url = `${API_ENDPOINTS.SHOP_DAILY_HOURS}?select=*&shop_id=eq.${shopId}&order=day_of_week.asc`;

      let response = await fetch(url, { headers: buildHeaders(hasAuth) });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`❌ Failed to fetch shop daily hours: ${response.status}`, errorText);
        throw new Error(`Failed to fetch shop daily hours: ${response.status} ${errorText}`);
      }

      let rows = await response.json() as ShopDailyHoursEntity[];

      // Carica sempre i time slots separatamente (più affidabile della relazione embedded)
      if (rows.length > 0) {
        const dailyHoursIds = rows.map(r => r.id);
        // PostgREST supporta filtri IN con la sintassi: column=in.(value1,value2,...)
        const idsFilter = dailyHoursIds.join(',');
        const timeSlotsUrl = `${API_ENDPOINTS.SHOP_DAILY_TIME_SLOTS}?select=*&daily_hours_id=in.(${idsFilter})&order=daily_hours_id.asc,position.asc`;

        // Usa la stessa autenticazione usata per i daily_hours
        const timeSlotsResponse = await fetch(timeSlotsUrl, { headers: buildHeaders(hasAuth) });

        if (timeSlotsResponse.ok) {
          const allTimeSlots = await timeSlotsResponse.json() as ShopDailyTimeSlotRow[];

          // Crea una mappa per raggruppare i time slots per daily_hours_id
          const timeSlotsMap = new Map<string, ShopDailyTimeSlotRow[]>();

          allTimeSlots.forEach(slot => {
            if (!timeSlotsMap.has(slot.daily_hours_id)) {
              timeSlotsMap.set(slot.daily_hours_id, []);
            }
            timeSlotsMap.get(slot.daily_hours_id)!.push(slot);
          });

          // Aggiungi i time slots ai rispettivi giorni
          rows = rows.map(row => ({
            ...row,
            shop_daily_time_slots: timeSlotsMap.get(row.id) || []
          }));

        } else {
          const errorText = await timeSlotsResponse.text().catch(() => 'Unknown error');
        }
      } else {
      }

      if (!Array.isArray(rows)) {
        console.error('❌ Invalid response format from shop_daily_hours:', rows);
        throw new Error('Invalid response format from shop_daily_hours');
      }


      // Se non ci sono orari configurati nel DB, usa i default (aperto Lun-Sab)
      // Questo evita che il calendario mostri "Nessun giorno aperto" per i nuovi shop o in caso di errore
      if (rows.length === 0) {
        return createDefaultShopHoursConfig();
      }

      // Inizializza tutti i giorni come chiusi (non usare il default che ha lunedì aperto)
      const config: ShopHoursConfig = {
        0: { isOpen: false, timeSlots: [] }, // Domenica
        1: { isOpen: false, timeSlots: [] }, // Lunedì
        2: { isOpen: false, timeSlots: [] }, // Martedì
        3: { isOpen: false, timeSlots: [] }, // Mercoledì
        4: { isOpen: false, timeSlots: [] }, // Giovedì
        5: { isOpen: false, timeSlots: [] }, // Venerdì
        6: { isOpen: false, timeSlots: [] }, // Sabato
      };

      // Load shop hours from database
      rows.forEach((row) => {
        if (row.day_of_week < 0 || row.day_of_week > 6) {
          return;
        }

        // Debug: verifica se i time slots sono presenti
        if (!row.shop_daily_time_slots) {
        } else {
        }

        const timeSlots = (row.shop_daily_time_slots ?? [])
          .sort((a, b) => {
            const positionDiff = (a.position ?? 0) - (b.position ?? 0);
            if (positionDiff !== 0) return positionDiff;
            return (a.start_time ?? '').localeCompare(b.start_time ?? '');
          })
          .map((slot: ShopDailyTimeSlotRow): TimeSlot | null => {
            try {
              const start = formatTimeToHHMM(slot.start_time ?? '');
              const end = formatTimeToHHMM(slot.end_time ?? '');
              if (!start || !end || start === '00:00' && end === '00:00') {
                return null;
              }
              return { start, end };
            } catch (error) {
              console.error(`❌ Error parsing time slot for day ${row.day_of_week}:`, error, slot);
              return null;
            }
          })
          .filter((slot): slot is TimeSlot => slot !== null);


        config[row.day_of_week] = {
          isOpen: row.is_open ?? false,
          timeSlots,
        };
      });


      // Verifica che almeno un giorno sia stato caricato correttamente
      const hasLoadedData = rows.length > 0;
      if (!hasLoadedData) {
      }

      return config;
    } catch (error) {
      console.error('❌ Error loading daily shop hours:', error);
      // Non restituire la configurazione di default se c'è un errore,
      // perché potrebbe sovrascrivere i dati esistenti in cache
      // Lascia che l'hook gestisca il fallback alla cache locale
      throw error;
    }
  },

  async saveDailyShopHours(hoursConfig: ShopHoursConfig): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      return false;
    }

    try {
      let shopId = getStoredShopId();
      if (!shopId || shopId === 'default') {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
        // Assicurati che lo shop_id sia salvato nel localStorage
        if (shopId && shopId !== 'default') {
          localStorage.setItem('current_shop_id', shopId);
        }
      }
      if (!shopId || shopId === 'default') {
        throw new Error('Impossibile determinare l\'ID del negozio');
      }

      const headers = buildHeaders(true);

      // Usa fetchWithTokenRefresh per gestire automaticamente il refresh del token
      const existingRes = await fetchWithTokenRefresh(
        `${API_ENDPOINTS.SHOP_DAILY_HOURS}?select=*,shop_daily_time_slots(*)&shop_id=eq.${shopId}`,
        { headers },
        true
      );
      if (!existingRes.ok) {
        const errorText = await existingRes.text();
        throw new Error(`Failed to load existing shop hours: ${existingRes.status} ${errorText}`);
      }
      const existingRows = await existingRes.json() as ShopDailyHoursEntity[];
      const existingMap = new Map<number, ShopDailyHoursEntity>();
      existingRows.forEach((row) => existingMap.set(row.day_of_week, row));


      const changedDays: number[] = [];

      for (let day = 0; day < 7; day += 1) {
        const dayConfig = hoursConfig[day] ?? { isOpen: false, timeSlots: [] };
        const existingDay = existingRows.find(r => r.day_of_week === day);


        // Se il giorno non esiste nel database, deve essere creato o aggiornato
        if (!existingDay) {
          // Se il giorno è aperto o ha time slots, deve essere creato
          // IMPORTANTE: anche se è chiuso ma ha time slots, deve essere creato per mantenere la struttura
          if (dayConfig.isOpen || dayConfig.timeSlots.length > 0) {
            changedDays.push(day);
          } else {
            // Se è chiuso e non ha slot, potrebbe non essere necessario crearlo
            // Ma se lo stato locale dice che è chiuso, creiamolo comunque per mantenere la struttura
          }
          continue;
        }

        // Verifica se is_open è cambiato
        if (existingDay.is_open !== dayConfig.isOpen) {
          changedDays.push(day);
          continue;
        }

        // Se il giorno è chiuso, non ci sono time slots da confrontare
        if (!dayConfig.isOpen) {
          // Se ci sono time slots nel database ma il giorno è chiuso, dobbiamo eliminarli
          if (existingDay.shop_daily_time_slots && existingDay.shop_daily_time_slots.length > 0) {
            changedDays.push(day);
          }
          continue;
        }

        // Confronta i time slots (ordinati per start_time)
        const existingSlots = (existingDay.shop_daily_time_slots ?? [])
          .map(slot => ({
            start: normalizeTimeString(slot.start_time ?? ''),
            end: normalizeTimeString(slot.end_time ?? ''),
          }))
          .sort((a, b) => a.start.localeCompare(b.start));

        const configSlots = dayConfig.timeSlots
          .map(slot => ({
            start: normalizeTimeString(slot.start),
            end: normalizeTimeString(slot.end),
          }))
          .sort((a, b) => a.start.localeCompare(b.start));

        if (existingSlots.length !== configSlots.length) {
          changedDays.push(day);
          continue;
        }

        // Confronta ogni slot
        const slotsDiffer = existingSlots.some((slot, idx) => {
          const configSlot = configSlots[idx];
          return !configSlot || slot.start !== configSlot.start || slot.end !== configSlot.end;
        });

        if (slotsDiffer) {
          changedDays.push(day);
        }
      }

      if (changedDays.length === 0) {
        // Se non ci sono righe nel database (shop nuovo o mai configurato), 
        // dobbiamo salvare TUTTI i giorni per inizializzare il DB ed evitare il fallback ai default
        if (existingRows.length === 0) {
          // Salva tutti i giorni (0-6) indipendentemente dallo stato
          for (let day = 0; day < 7; day += 1) {
            changedDays.push(day);
          }
        } else {
          // Se ci sono righe nel database ma nessun cambiamento rilevato, 
          // saltiamo il salvataggio
          return false;
        }
      }




      // Processa solo i giorni che sono cambiati
      for (const day of changedDays) {
        const dayConfig = hoursConfig[day] ?? { isOpen: false, timeSlots: [] };
        let currentRow = existingMap.get(day);

        if (currentRow) {
          const updateRes = await fetchWithTokenRefresh(
            `${API_ENDPOINTS.SHOP_DAILY_HOURS}?id=eq.${currentRow.id}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ is_open: dayConfig.isOpen }),
            },
            true
          );
          if (!updateRes.ok) {
            const errorText = await updateRes.text();
            console.error(`❌ Failed to update shop hours for day ${day}:`, errorText);
            throw new Error(`Failed to update shop hours (${day}): ${errorText}`);
          }
        } else {
          // Prova a creare il record. Se fallisce per unique constraint, prova a fare upsert
          const createRes = await fetchWithTokenRefresh(
            API_ENDPOINTS.SHOP_DAILY_HOURS,
            {
              method: 'POST',
              headers: { ...headers, Prefer: 'return=representation,resolution=merge-duplicates' },
              body: JSON.stringify([{
                shop_id: shopId,
                day_of_week: day,
                is_open: dayConfig.isOpen,
              }]),
            },
            true
          );
          if (!createRes.ok) {
            const errorText = await createRes.text();
            // Se è un errore di unique constraint, prova a fare un upsert esplicito
            if (errorText.includes('duplicate') || errorText.includes('unique') || createRes.status === 409) {
              // Ricarica i record esistenti e aggiorna
              const retryRes = await fetchWithTokenRefresh(
                `${API_ENDPOINTS.SHOP_DAILY_HOURS}?shop_id=eq.${shopId}&day_of_week=eq.${day}&select=*&limit=1`,
                { headers },
                true
              );
              if (retryRes.ok) {
                const existing = await retryRes.json() as ShopDailyHoursEntity[];
                if (existing && existing.length > 0) {
                  currentRow = existing[0];
                  existingMap.set(day, currentRow);
                  // Aggiorna il record esistente
                  const updateRes = await fetchWithTokenRefresh(
                    `${API_ENDPOINTS.SHOP_DAILY_HOURS}?id=eq.${currentRow.id}`,
                    {
                      method: 'PATCH',
                      headers,
                      body: JSON.stringify({ is_open: dayConfig.isOpen }),
                    },
                    true
                  );
                  if (updateRes.ok) {
                    continue; // Skip to next day
                  } else {
                    const updateErrorText = await updateRes.text();
                    console.error(`❌ Failed to update existing day ${day}:`, updateErrorText);
                    throw new Error(`Failed to update daily hours (${day}): ${updateErrorText}`);
                  }
                }
              }
            }
            console.error(`❌ Failed to create shop hours for day ${day}:`, errorText);
            throw new Error(`Failed to create daily hours (${day}): ${errorText}`);
          }
          const created = await createRes.json() as ShopDailyHoursEntity[];
          if (!created || created.length === 0) {
            console.error(`❌ Created day ${day} but got no response`);
            throw new Error(`Failed to create daily hours (${day}): No data returned`);
          }
          currentRow = created[0];
          existingMap.set(day, currentRow);
        }

        if (!currentRow) {
          continue;
        }

        // Elimina i time slots esistenti prima di inserire quelli nuovi
        const deleteSlotsRes = await fetchWithTokenRefresh(
          `${API_ENDPOINTS.SHOP_DAILY_TIME_SLOTS}?daily_hours_id=eq.${currentRow.id}`,
          {
            method: 'DELETE',
            headers,
          },
          true
        );
        if (!deleteSlotsRes.ok) {
          const errorText = await deleteSlotsRes.text();
          console.error(`❌ Failed to clear time slots for day ${day}:`, {
            status: deleteSlotsRes.status,
            error: errorText,
            daily_hours_id: currentRow.id
          });
          throw new Error(`Failed to clear time slots (${day}): ${deleteSlotsRes.status} ${errorText}`);
        }

        if (dayConfig.isOpen && dayConfig.timeSlots.length > 0) {
          // Valida i time slots prima di salvarli
          const validSlots = dayConfig.timeSlots.filter(slot => {
            if (!slot.start || !slot.end) {
              return false;
            }
            const start = normalizeTimeString(slot.start);
            const end = normalizeTimeString(slot.end);
            if (start >= end) {
              return false;
            }
            return true;
          });

          if (validSlots.length > 0) {
            const payload = validSlots.map((slot, index) => ({
              daily_hours_id: currentRow!.id,
              start_time: normalizeTimeString(slot.start),
              end_time: normalizeTimeString(slot.end),
              position: index,
            }));

            const insertSlotsRes = await fetchWithTokenRefresh(
              API_ENDPOINTS.SHOP_DAILY_TIME_SLOTS,
              {
                method: 'POST',
                headers: { ...headers, Prefer: 'return=representation' },
                body: JSON.stringify(payload),
              },
              true
            );
            if (!insertSlotsRes.ok) {
              const errorText = await insertSlotsRes.text();
              console.error(`❌ Failed to insert time slots for day ${day}:`, {
                status: insertSlotsRes.status,
                error: errorText,
                payload: payload,
                headers: Object.fromEntries(Object.entries(headers))
              });
              throw new Error(`Failed to insert time slots (${day}): ${insertSlotsRes.status} ${errorText}`);
            }

            // Verifica che i time slots siano stati inseriti
            try {
              const inserted = await insertSlotsRes.json();
            } catch (parseError) {
              // Se la risposta è vuota (return=minimal), va bene
            }
          } else if (dayConfig.timeSlots.length > 0) {
          }
        }
      }

      return true; // Indica che il salvataggio è stato completato con successo
    } catch (error) {
      console.error('❌ Error saving daily shop hours:', error);
      throw error;
    }
  },

  // Get appointments
  async getAppointments(start: string, end: string): Promise<Appointment[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      // Usa buildHeaders(true) per autenticazione e filtro RLS per shop_id
      // Le RLS policies filtrano automaticamente per shop_id tramite current_shop_id()
      // Include services per mostrare nome servizio e durata
      // PostgREST accetta date ISO nel formato RFC3339
      // Costruiamo la query URL con i parametri correttamente codificati
      const params = new URLSearchParams({
        select: '*,clients(id,first_name,last_name,phone_e164,email),staff(full_name,chair_id),services(id,name,duration_min)',
        order: 'start_at.asc',
      });

      // PostgREST usa operatori di filtro nella sintassi: column.operator.value
      // Per il range, usiamo due filtri separati
      const url = `${API_ENDPOINTS.APPOINTMENTS_FEED}?${params.toString()}&start_at=gte.${encodeURIComponent(start)}&start_at=lte.${encodeURIComponent(end)}`;

      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error fetching appointments:', response.status, errorText);
        // Se è un errore di rete (ERR_INSUFFICIENT_RESOURCES), non lanciare errore
        // per evitare loop infiniti
        if (response.status === 0 || errorText.includes('ERR_INSUFFICIENT_RESOURCES')) {
          console.warn('⚠️ Network error detected in getAppointments, returning empty array to avoid loop');
          return [];
        }
        throw new Error(`Failed to fetch appointments: ${response.status}`);
      }
      const data = await response.json();
      if (data.length > 0) {
      }
      return data;
    } catch (error) {
      // Se l'errore è di tipo network (ERR_INSUFFICIENT_RESOURCES), non loggare
      // per evitare spam nella console
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('⚠️ Network error in getAppointments (likely ERR_INSUFFICIENT_RESOURCES), returning empty array');
        return [];
      }
      console.error('❌ Error fetching appointments:', error);
      return [];
    }
  },

  // Create appointment via n8n webhook (legacy)
  async createAppointment(data: CreateAppointmentRequest): Promise<void> {
    // Se N8N non è configurato, usa createAppointmentDirect come fallback
    if (!API_CONFIG.N8N_BASE_URL) {
      await this.createAppointmentDirect({
        client_id: data.client_id,
        client_name: (data as any).client_name,
        staff_id: data.staff_id,
        service_id: data.service_id,
        start_at: data.start_at,
        end_at: data.end_at,
        notes: data.notes,
        status: data.status || 'scheduled',
        products: data.products,
      });
      return;
    }

    if (!isSupabaseConfigured()) throw new Error('Backend non configurato');

    try {
      const response = await fetch(API_ENDPOINTS.CREATE_APPOINTMENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create appointment');
    } catch (error) {
      console.error('Error creating appointment via N8N, trying direct method:', error);
      // Fallback a creazione diretta se N8N fallisce
      await this.createAppointmentDirect({
        client_id: data.client_id,
        client_name: (data as any).client_name,
        staff_id: data.staff_id,
        service_id: data.service_id,
        start_at: data.start_at,
        end_at: data.end_at,
        notes: data.notes,
        status: data.status || 'scheduled',
        products: data.products,
      });
    }
  },

  // Create appointment directly in Supabase (for client bookings)
  async createAppointmentDirect(data: {
    client_id: string | null;
    client_name?: string;
    staff_id: string;
    service_id: string;
    start_at: string;
    end_at: string;
    notes?: string;
    status?: string;
    products?: Array<{
      productId: string;
      quantity: number;
      productName?: string;
      productPrice?: number;
    }>;
  }): Promise<any> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const normalizedClientId =
        typeof data.client_id === 'string' && data.client_id.trim().length > 0 ? data.client_id.trim() : null;
      const normalizedClientName =
        typeof data.client_name === 'string' && data.client_name.trim().length > 0 ? data.client_name.trim() : null;

      if (!normalizedClientId && !normalizedClientName) {
        throw new Error('Seleziona un cliente oppure inserisci un nome cliente (cliente senza account)');
      }

      // Check for overlapping appointments before creating
      const startDate = new Date(data.start_at);
      const endDate = new Date(data.end_at);

      // Normalize dates to avoid timezone issues
      const startTime = startDate.getTime();
      const endTime = endDate.getTime();

      // Check only the same day to avoid unnecessary queries
      const checkStart = new Date(startDate);
      checkStart.setHours(0, 0, 0, 0);
      const checkEnd = new Date(startDate);
      checkEnd.setHours(23, 59, 59, 999);

      const existingAppointments = await this.getAppointments(
        checkStart.toISOString(),
        checkEnd.toISOString()
      );

      // Filter appointments for the same staff and check for overlaps
      const overlappingAppointments = existingAppointments.filter(apt => {
        // Skip cancelled appointments
        if (apt.status === 'cancelled') return false;

        // Must be same staff
        if (apt.staff_id !== data.staff_id) return false;

        const aptStart = new Date(apt.start_at);
        const aptEnd = apt.end_at ? new Date(apt.end_at) : new Date(aptStart.getTime() + (apt.services?.duration_min || 30) * 60000);

        const aptStartTime = aptStart.getTime();
        const aptEndTime = aptEnd.getTime();

        // Check if appointments overlap: start1 < end2 && end1 > start2
        // But allow exact boundaries (one ends exactly when the other starts)
        const hasOverlap = startTime < aptEndTime && endTime > aptStartTime;

        // Log for debugging
        if (hasOverlap) {
        }

        return hasOverlap;
      });

      if (overlappingAppointments.length > 0) {
        console.error('❌ Overlapping appointments found:', overlappingAppointments);
        throw new Error('Impossibile creare l\'appuntamento: c\'è un conflitto con un altro appuntamento per lo stesso barbiere');
      }

      // Resolve shop_id with multiple fallbacks to satisfy RLS
      let shopId = getStoredShopId();
      let shop: Shop | null = null;
      if (!shopId) {
        shop = await this.getShop();
        shopId = shop?.id ?? null;
      } else {
        // Get shop to check products_enabled even if we already have shopId
        try {
          shop = await this.getShop();
        } catch (e) {
          // If getShop fails, continue without shop - products will be filtered out
        }
      }
      if (!shopId || shopId === 'default') {
        try {
          const profile = await this.getUserProfile();
          shopId = (profile as any)?.shop_id ?? shopId;
        } catch (e) {
        }
      }

      const resolvedShopId = shopId && shopId !== 'default' ? shopId : null;
      if (!resolvedShopId) {
        throw new Error('Impossibile creare l\'appuntamento: shop non impostato per questo utente');
      }

      // Validate that the appointment date is not on a closed day
      try {
        const appointmentDate = new Date(startDate);
        appointmentDate.setHours(0, 0, 0, 0);
        const dayOfWeek = appointmentDate.getDay();

        // Load shop hours to check if the day is closed
        const shopHours = await this.getDailyShopHours();
        const dayHours = shopHours[dayOfWeek];

        // Check if it's a regular closed day
        if (!dayHours || !dayHours.isOpen || dayHours.timeSlots.length === 0) {
          // Check if it's an Italian holiday and auto_close_holidays is enabled
          const autoCloseHolidays = shop?.auto_close_holidays ?? true;
          if (autoCloseHolidays && isItalianHoliday(appointmentDate)) {
            throw new Error('Impossibile prenotare: il negozio è chiuso in questo giorno festivo');
          }

          // If it's a regular closed day (not a holiday), throw error
          const dayNames = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
          throw new Error(`Impossibile prenotare: il negozio è chiuso di ${dayNames[dayOfWeek]}`);
        }

        // Check if the selected time is within opening hours
        const appointmentTime = startDate.toTimeString().slice(0, 5); // HH:MM format
        const isTimeValid = dayHours.timeSlots.some(slot => {
          const [startHours, startMinutes] = slot.start.split(':').map(Number);
          const [endHours, endMinutes] = slot.end.split(':').map(Number);
          const [timeHours, timeMinutes] = appointmentTime.split(':').map(Number);
          const timeInMinutes = timeHours * 60 + timeMinutes;
          const startTime = startHours * 60 + startMinutes;
          const endTime = endHours * 60 + endMinutes;
          return timeInMinutes >= startTime && timeInMinutes < endTime;
        });

        if (!isTimeValid) {
          throw new Error('Impossibile prenotare: l\'orario selezionato è fuori dagli orari di apertura');
        }
      } catch (error) {
        // If it's already an Error with a message, re-throw it
        if (error instanceof Error && error.message.includes('Impossibile prenotare')) {
          throw error;
        }
        // If it's an error from getDailyShopHours, log it but don't block the appointment
        // (fallback: allow the appointment if we can't verify shop hours)
        console.warn('⚠️ Could not validate shop hours, allowing appointment:', error);
      }

      // Check if products are enabled for this shop
      const areProductsEnabled = shop?.products_enabled === true;

      // Format products for JSONB storage - only if products_enabled is true
      const productsArray = (areProductsEnabled && data.products && data.products.length > 0)
        ? data.products.map(p => ({
          productId: p.productId,
          quantity: p.quantity,
          productName: p.productName,
          productPrice: p.productPrice,
        }))
        : [];

      const payload: any = {
        shop_id: resolvedShopId,
        client_id: normalizedClientId,
        client_name: normalizedClientName,
        staff_id: data.staff_id,
        service_id: data.service_id,
        start_at: data.start_at,
        end_at: data.end_at,
        notes: data.notes || '',
        status: data.status || 'confirmed',
      };

      // Add products only if provided, not empty, and products_enabled is true
      if (productsArray.length > 0) {
        payload.products = productsArray;
      }

      // Usa fetchWithTokenRefresh per gestire automaticamente il refresh del token
      const response = await fetchWithTokenRefresh(
        API_ENDPOINTS.APPOINTMENTS_FEED,
        {
          method: 'POST',
          headers: { ...buildHeaders(true), Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        },
        true
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore creazione appuntamento:', response.status, errorText);
        throw new Error(`Failed to create appointment: ${response.status} ${errorText}`);
      }

      const created = await response.json();
      return created[0];
    } catch (error) {
      console.error('❌ Errore critico creazione appuntamento:', error);
      throw error;
    }
  },

  // Update appointment
  async updateAppointment(data: UpdateAppointmentRequest): Promise<void> {
    if (!isSupabaseConfigured() || !API_CONFIG.N8N_BASE_URL) throw new Error('Backend non configurato');

    try {
      const response = await fetch(API_ENDPOINTS.UPDATE_APPOINTMENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update appointment');
    } catch (error) {
      console.error('Error updating appointment:', error);
      throw error;
    }
  },

  // Trigger appointment modified webhook (Supabase Edge / n8n)
  async triggerAppointmentModifiedHook(data: UpdateAppointmentRequest): Promise<void> {
    if (!isSupabaseConfigured() || !API_CONFIG.SUPABASE_EDGE_URL) throw new Error('Backend non configurato');

    try {
      const url = `${API_CONFIG.SUPABASE_EDGE_URL}/functions/v1/appointment_modified_hook`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...buildHeaders(true) },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to trigger appointment_modified_hook: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Error triggering appointment_modified_hook:', error);
      throw error;
    }
  },

  // Update appointment directly in Supabase (client reschedule)
  async updateAppointmentDirect(data: UpdateAppointmentRequest): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    if (!data.id) throw new Error('ID appuntamento mancante');

    try {
      // Recupera l'appuntamento corrente per staff e durata fallback
      const currentRes = await fetch(`${API_ENDPOINTS.APPOINTMENTS_FEED}?id=eq.${data.id}&select=*`, {
        headers: buildHeaders(true),
      });
      const currentJson = currentRes.ok ? await currentRes.json() : [];
      const current = (currentJson as Appointment[])[0];

      const staffId = data.staff_id || current?.staff_id;
      const serviceId = data.service_id || current?.service_id;
      const startAt = data.start_at || current?.start_at;
      const endAt = data.end_at || current?.end_at;

      if (!staffId || !serviceId || !startAt || !endAt) {
        throw new Error('Dati incompleti per aggiornare la prenotazione');
      }

      // Controllo overlap nello stesso giorno
      const startDate = new Date(startAt);
      const dayStart = new Date(startDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(startDate);
      dayEnd.setHours(23, 59, 59, 999);

      const sameDayAppointments = await this.getAppointments(dayStart.toISOString(), dayEnd.toISOString());

      const newStart = new Date(startAt).getTime();
      const newEnd = new Date(endAt).getTime();

      const overlaps = sameDayAppointments.some((apt) => {
        if (apt.id === data.id) return false;
        if (apt.status === 'cancelled') return false;
        if (apt.staff_id !== staffId) return false;
        const aptStart = new Date(apt.start_at).getTime();
        const aptEnd = apt.end_at
          ? new Date(apt.end_at).getTime()
          : aptStart + ((apt.services?.duration_min || current?.services?.duration_min || 30) * 60 * 1000);
        return newStart < aptEnd && newEnd > aptStart;
      });

      if (overlaps) {
        throw new Error('Slot non disponibile: conflitto con un altro appuntamento');
      }

      // Check if products are enabled for this shop
      let shop: Shop | null = null;
      try {
        shop = await this.getShop();
      } catch (e) {
        // If getShop fails, continue without shop - products will be filtered out
      }
      const areProductsEnabled = shop?.products_enabled === true;

      // Format products for JSONB storage - only if products_enabled is true
      const productsArray = (areProductsEnabled && data.products && data.products.length > 0)
        ? data.products.map(p => ({
          productId: p.productId,
          quantity: p.quantity,
          productName: p.productName,
          productPrice: p.productPrice,
        }))
        : (data.products === null || data.products === undefined)
          ? undefined
          : []; // If products is explicitly set to empty array, clear it

      const payload: Record<string, unknown> = {
        start_at: startAt,
        end_at: endAt,
      };
      if (data.status) payload.status = data.status;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (serviceId) payload.service_id = serviceId;
      if (staffId) payload.staff_id = staffId;

      // Handle products update - only if products_enabled is true
      if (productsArray !== undefined) {
        if (areProductsEnabled && productsArray.length > 0) {
          payload.products = productsArray;
        } else if (productsArray.length === 0) {
          // Explicitly clear products if empty array is provided
          payload.products = [];
        }
      }

      const response = await fetchWithTokenRefresh(
        `${API_ENDPOINTS.APPOINTMENTS_FEED}?id=eq.${data.id}`,
        {
          method: 'PATCH',
          headers: { ...buildHeaders(true), Prefer: 'return=minimal' },
          body: JSON.stringify(payload),
        },
        true
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore updateAppointmentDirect:', response.status, errorText);
        throw new Error(`Failed to update appointment: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Errore critico updateAppointmentDirect:', error);
      throw error;
    }
  },

  // Cancel appointment
  async cancelAppointment(id: string): Promise<void> {
    if (!isSupabaseConfigured() || !API_CONFIG.N8N_BASE_URL) throw new Error('Backend non configurato');

    try {
      const response = await fetch(API_ENDPOINTS.CANCEL_APPOINTMENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Failed to cancel appointment');
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      throw error;
    }
  },

  // Cancel appointments in date range (for vacation mode)
  async cancelAppointmentsInRange(startDate: string, endDate: string): Promise<void> {
    if (!isSupabaseConfigured() || !API_CONFIG.N8N_BASE_URL) {
      return; // Permetti l'attivazione della modalità ferie anche senza backend
    }

    try {
      // First, get all appointments in the date range
      const appointments = await this.getAppointments(startDate, endDate);

      // Cancel each appointment
      const cancelPromises = appointments.map(appointment =>
        this.cancelAppointment(appointment.id)
      );

      await Promise.all(cancelPromises);
    } catch (error) {
      console.error('Error canceling appointments in range:', error);
      throw error;
    }
  },

  // Get user profile
  async getUserProfile(): Promise<Profile> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const url = `${API_ENDPOINTS.PROFILES}?select=*&limit=1`;
      const response = await fetch(url, { headers: buildHeaders() });
      if (!response.ok) throw new Error('Failed to fetch user profile');
      const profiles = await response.json();
      return profiles[0];
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  },

  // Upload profilo cliente su bucket privato e restituisce path + signed URL
  async uploadProfilePhotoSecure(file: File, userId: string): Promise<{ path: string; signedUrl: string }> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    const accessToken = getAuthToken();
    if (!accessToken) throw new Error('Token non trovato. Effettua di nuovo il login.');

    const bucket = 'profile-photos-private';
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const ext = mimeToExt[file.type] || 'jpg';
    const objectPath = `${userId}/profile.${ext}`;

    // Best-effort cleanup: rimuove versioni precedenti con estensioni diverse
    const candidateExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const deletePromises = candidateExts.map((e) => {
      const delPath = `${userId}/profile.${e}`;
      const delUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/${delPath}`;
      return fetch(delUrl, {
        method: 'DELETE',
        headers: {
          apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
          Authorization: `Bearer ${accessToken}`,
        },
      }).catch(() => undefined);
    });
    await Promise.allSettled(deletePromises);

    const uploadUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/${objectPath}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload foto profilo fallito: ${uploadRes.status} ${errText}`);
    }

    // Genera signed URL (es. 7 giorni)
    const signUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/sign/${bucket}/${objectPath}`;
    const signRes = await fetch(signUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
    });
    if (!signRes.ok) {
      const errText = await signRes.text();
      throw new Error(`Signed URL fallita: ${signRes.status} ${errText}`);
    }
    const signJson = await signRes.json();
    const signedUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1${signJson.signedURL || signJson.signedUrl || ''}`;

    return { path: objectPath, signedUrl };
  },

  async getSignedProfilePhotoUrl(path: string): Promise<string> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    const accessToken = getAuthToken();
    if (!accessToken) throw new Error('Token non trovato. Effettua di nuovo il login.');
    const bucket = 'profile-photos-private';
    const signUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/sign/${bucket}/${path}`;
    const signRes = await fetch(signUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
    });
    if (!signRes.ok) {
      const errText = await signRes.text();
      throw new Error(`Signed URL fallita: ${signRes.status} ${errText}`);
    }
    const signJson = await signRes.json();
    return `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1${signJson.signedURL || signJson.signedUrl || ''}`;
  },

  // Upload foto cliente su bucket pubblico in lettura (client-photos) con path deterministico clients/<userId>/profile.ext
  async uploadClientPhotoPublic(file: File, userId: string): Promise<{ path: string; publicUrl: string }> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    const accessToken = getAuthToken();
    if (!accessToken) throw new Error('Token non trovato. Effettua di nuovo il login.');

    const bucket = 'client-photos';
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const ext = mimeToExt[file.type] || 'jpg';
    const objectPath = `clients/${userId}/profile.${ext}`;

    // best-effort cleanup di estensioni precedenti
    const candidateExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    await Promise.allSettled(
      candidateExts.map((e) =>
        fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/clients/${userId}/profile.${e}`, {
          method: 'DELETE',
          headers: {
            apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${accessToken}`,
          },
        }).catch(() => undefined)
      )
    );

    const uploadUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/${objectPath}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload foto cliente fallito: ${uploadRes.status} ${errText}`);
    }

    const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
    return { path: objectPath, publicUrl };
  },

  getPublicClientPhotoUrl(path: string): string {
    return `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/client-photos/${path}`;
  },

  // Upload foto staff in bucket pubblico in lettura (staff-photos) con path deterministico staff/<staffId>/profile.ext
  async uploadStaffPhotoPublic(file: File, staffId: string): Promise<{ path: string; publicUrl: string }> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    const accessToken = getAuthToken();
    if (!accessToken) throw new Error('Token non trovato. Effettua di nuovo il login.');

    const bucket = 'staff-photos';
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const ext = mimeToExt[file.type] || 'jpg';
    const objectPath = `staff/${staffId}/profile.${ext}`;

    // best-effort cleanup di estensioni precedenti
    const candidateExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    await Promise.allSettled(
      candidateExts.map((e) =>
        fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/staff/${staffId}/profile.${e}`, {
          method: 'DELETE',
          headers: {
            apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${accessToken}`,
          },
        }).catch(() => undefined)
      )
    );

    const uploadUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/${objectPath}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload foto staff fallito: ${uploadRes.status} ${errText}`);
    }

    const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
    return { path: objectPath, publicUrl };
  },

  // Upload logo negozio pubblico (bucket pubblico, accesso autenticato)
  async uploadShopLogoPublic(file: File, shopId: string): Promise<{ path: string; publicUrl: string }> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    const accessToken = localStorage.getItem('auth_token');
    if (!accessToken) throw new Error('Token non trovato. Effettua di nuovo il login.');

    const bucket = 'shop-logos';
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const ext = mimeToExt[file.type] || 'jpg';
    const objectPath = `shops/${shopId}/logo.${ext}`;

    // best-effort cleanup di estensioni precedenti
    const candidateExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    await Promise.allSettled(
      candidateExts.map((e) =>
        fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/shops/${shopId}/logo.${e}`, {
          method: 'DELETE',
          headers: {
            apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${accessToken}`,
          },
        }).catch(() => undefined)
      )
    );

    const uploadUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/${objectPath}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload logo negozio fallito: ${uploadRes.status} ${errText}`);
    }

    const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
    return { path: objectPath, publicUrl };
  },

  // Upload foto prodotto in bucket pubblico (product-photos) con path shops/{shopId}/products/{productId}/image.ext
  async uploadProductPhotoPublic(file: File, shopId: string, productId: string): Promise<{ path: string; publicUrl: string }> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    const accessToken = getAuthToken();
    if (!accessToken) throw new Error('Token non trovato. Effettua di nuovo il login.');

    const bucket = 'product-photos';
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    };
    const ext = mimeToExt[file.type] || 'jpg';
    const objectPath = `shops/${shopId}/products/${productId}/image.${ext}`;

    // best-effort cleanup di estensioni precedenti
    const candidateExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    await Promise.allSettled(
      candidateExts.map((e) =>
        fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/shops/${shopId}/products/${productId}/image.${e}`, {
          method: 'DELETE',
          headers: {
            apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${accessToken}`,
          },
        }).catch(() => undefined)
      )
    );

    const uploadUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/${objectPath}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload foto prodotto fallito: ${uploadRes.status} ${errText}`);
    }

    const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/${bucket}/${objectPath}`;
    return { path: objectPath, publicUrl };
  },

  // Upload logo negozio (bucket protetto, accesso autenticato)
  async uploadShopLogo(file: File, shopId: string): Promise<{ path: string; signedUrl: string }> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    const accessToken = getAuthToken();
    if (!accessToken) throw new Error('Token non trovato. Effettua di nuovo il login.');

    const bucket = 'shop-logos';
    const mimeToExt: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
    };
    const ext = mimeToExt[file.type] || 'jpg';
    const objectPath = `shops/${shopId}/logo.${ext}`;

    const candidateExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'];
    await Promise.allSettled(
      candidateExts.map((e) =>
        fetch(`${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/shops/${shopId}/logo.${e}`, {
          method: 'DELETE',
          headers: {
            apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
            Authorization: `Bearer ${accessToken}`,
          },
        }).catch(() => undefined)
      )
    );

    const uploadUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/${bucket}/${objectPath}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': file.type,
        'x-upsert': 'true',
      },
      body: file,
    });
    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Upload logo negozio fallito: ${uploadRes.status} ${errText}`);
    }

    // Signed URL (7 giorni)
    const signUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/sign/${bucket}/${objectPath}`;
    const signRes = await fetch(signUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
    });
    if (!signRes.ok) {
      const errText = await signRes.text();
      throw new Error(`Signed URL logo fallita: ${signRes.status} ${errText}`);
    }
    const signJson = await signRes.json();
    const signedUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1${signJson.signedURL || signJson.signedUrl || ''}`;

    return { path: objectPath, signedUrl };
  },

  async getSignedShopLogoUrl(path: string): Promise<string> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    const accessToken = getAuthToken();
    if (!accessToken) throw new Error('Token non trovato. Effettua di nuovo il login.');

    const bucket = 'shop-logos';
    const signUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/sign/${bucket}/${path}`;
    const signRes = await fetch(signUrl, {
      method: 'POST',
      headers: {
        apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
    });
    if (!signRes.ok) {
      const errText = await signRes.text();
      throw new Error(`Signed URL logo fallita: ${signRes.status} ${errText}`);
    }
    const signJson = await signRes.json();
    return `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1${signJson.signedURL || signJson.signedUrl || ''}`;
  },

  // Get signed shop logo URL without authentication (for login page)
  async getSignedShopLogoUrlPublic(path: string): Promise<string | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      const bucket = 'shop-logos';
      // Prova prima con URL pubblico (se bucket è pubblico)
      const publicUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/public/${bucket}/${path}`;

      // Verifica se l'URL pubblico funziona facendo una HEAD request
      const headRes = await fetch(publicUrl, { method: 'HEAD' });
      if (headRes.ok) {
        return publicUrl;
      }

      // Se il bucket è privato, prova a generare un signed URL con anon key
      // (funziona solo se le policy del bucket lo permettono)
      const signUrl = `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1/object/sign/${bucket}/${path}`;
      const signRes = await fetch(signUrl, {
        method: 'POST',
        headers: {
          apikey: API_CONFIG.SUPABASE_ANON_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
      });

      if (signRes.ok) {
        const signJson = await signRes.json();
        return `${API_CONFIG.SUPABASE_EDGE_URL}/storage/v1${signJson.signedURL || signJson.signedUrl || ''}`;
      }

      return null;
    } catch (error) {
      return null;
    }
  },

  // Get staff profile
  async getStaffProfile(): Promise<Staff> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      // CRITICO: Filtra per shop_id per evitare cross-shop
      let shopId = getStoredShopId();
      if (!shopId) {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
      }

      let url = `${API_ENDPOINTS.STAFF}?select=*&limit=1`;
      if (shopId && shopId !== 'default') {
        url += `&shop_id=eq.${shopId}`;
      }
      const response = await fetch(url, { headers: buildHeaders(false) }); // Use false for now to avoid auth issues
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        throw new Error(`Failed to fetch staff profile: ${response.status} ${errorText}`);
      }
      const staff = await response.json();
      if (!staff || staff.length === 0) {
        throw new Error('No staff profile found');
      }
      return staff[0];
    } catch (error) {
      console.error('Error fetching staff profile:', error);
      throw error;
    }
  },

  // Upsert staff profile (create if missing, update otherwise)
  async updateStaffProfile(data: Staff): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    try {
      const response = await fetch(API_ENDPOINTS.STAFF, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error (upsert staff):', response.status, errorText);
        throw new Error(`Failed to upsert staff profile: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Error upserting staff profile:', error);
      throw error;
    }
  },

  // Create service
  async createService(data: Partial<Service>): Promise<Service> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      // Assicurati che shop_id sia presente
      let shopId = data.shop_id || getStoredShopId();
      if (!shopId || shopId === 'default') {
        try {
          const shop = await this.getShop();
          shopId = shop?.id ?? null;
        } catch (shopError) {
        }
      }

      const payload = {
        ...data,
        shop_id: shopId && shopId !== 'default' ? shopId : undefined,
      };

      const response = await fetch(API_ENDPOINTS.SERVICES, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create service: ${response.status} ${errorText}`);
      }
      const created = await response.json();
      return created[0] as Service;
    } catch (error) {
      console.error('Error creating service:', error);
      throw error;
    }
  },

  // Update service
  async updateService(data: Service): Promise<Service> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(`${API_ENDPOINTS.SERVICES}?id=eq.${data.id}`, {
        method: 'PATCH',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update service');
      const updated = await response.json();
      return updated[0] as Service;
    } catch (error) {
      console.error('Error updating service:', error);
      throw error;
    }
  },

  // Delete service
  async deleteService(id: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(`${API_ENDPOINTS.SERVICES}?id=eq.${id}`, {
        method: 'DELETE',
        headers: { ...buildHeaders(true) },
      });
      if (!response.ok) throw new Error('Failed to delete service');
    } catch (error) {
      console.error('Error deleting service:', error);
      throw error;
    }
  },

  async getShopBySlug(slug: string): Promise<Shop> {

    if (!isSupabaseConfigured()) {
      return {
        id: 'default',
        slug: slug || DEFAULT_SHOP_SLUG,
        name: 'Retro Barbershop',
        address: '',
        postal_code: '',
        city: '',
        province: '',
        phone: '',
        whatsapp: '',
        email: '',
        description: '',
        opening_hours: '',
        extra_opening_date: null,
        extra_morning_start: null,
        extra_morning_end: null,
        extra_afternoon_start: null,
        extra_afternoon_end: null,
        vacation_period: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    try {
      const encodedSlug = encodeURIComponent(slug);
      const url = `${API_ENDPOINTS.SHOPS}?select=*&slug=eq.${encodedSlug}&limit=1`;


      const response = await fetch(url, { headers: buildHeaders(false) });


      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ getShopBySlug: Errore HTTP:', response.status, errorText);
        throw new Error(`Impossibile caricare shop con slug ${slug}: ${response.status} ${errorText}`);
      }

      const shops = await response.json();

      if (!shops || shops.length === 0) {
        console.error('❌ getShopBySlug: Nessun shop trovato con slug:', slug);
        throw new Error(`Nessun shop trovato con slug ${slug}`);
      }

      const shop = shops[0];

      persistShopLocally(shop);
      return shop;
    } catch (error) {
      console.error('❌ getShopBySlug: Errore durante caricamento:', error);
      throw error;
    }
  },

  async getShopById(id: string): Promise<Shop> {
    if (!isSupabaseConfigured()) {
      return {
        id: id,
        slug: DEFAULT_SHOP_SLUG,
        name: 'Retro Barbershop',
        address: '',
        postal_code: '',
        city: '',
        province: '',
        phone: '',
        whatsapp: '',
        email: '',
        description: '',
        opening_hours: '',
        extra_opening_date: null,
        extra_morning_start: null,
        extra_morning_end: null,
        extra_afternoon_start: null,
        extra_afternoon_end: null,
        vacation_period: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Usa buildHeaders(true) se l'utente è autenticato per rispettare RLS
    // Fallback a buildHeaders(false) solo se non c'è token (es. pagina login)
    const hasAuth = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    const url = `${API_ENDPOINTS.SHOPS}?select=*&id=eq.${id}&limit=1`;

    let response: Response;
    if (hasAuth) {
      // Usa fetchWithTokenRefresh per gestire automaticamente il refresh del token se scaduto
      response = await fetchWithTokenRefresh(url, { headers: buildHeaders(true) }, true);
    } else {
      // Accesso pubblico senza autenticazione
      response = await fetch(url, { headers: buildHeaders(false) });
    }
    if (!response.ok) {
      throw new Error(`Impossibile caricare shop con id ${id}`);
    }
    const shops = await response.json();
    if (!shops || shops.length === 0) {
      throw new Error(`Nessun shop trovato con id ${id}`);
    }
    const shop = shops[0];
    persistShopLocally(shop);
    return shop;
  },

  // Get shop (usa autenticazione se disponibile per rispettare RLS)
  async getShop(slugOverride?: string): Promise<Shop> {
    if (!isSupabaseConfigured()) {
      // Restituisci shop di default se Supabase non è configurato
      return {
        id: 'default',
        slug: slugOverride || DEFAULT_SHOP_SLUG,
        name: 'Retro Barbershop',
        address: '',
        postal_code: '',
        city: '',
        province: '',
        phone: '',
        whatsapp: '',
        email: '',
        description: '',
        opening_hours: '',
        extra_opening_date: null,
        extra_morning_start: null,
        extra_morning_end: null,
        extra_afternoon_start: null,
        extra_afternoon_end: null,
        vacation_period: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    try {
      const slugToUse = slugOverride || getEffectiveSlug();
      // Usa buildHeaders(true) se l'utente è autenticato per rispettare RLS
      // Fallback a buildHeaders(false) solo se non c'è token (es. pagina login)
      const hasAuth = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      const url = `${API_ENDPOINTS.SHOPS}?select=*&slug=eq.${encodeURIComponent(slugToUse)}&limit=1`;

      let response: Response;
      if (hasAuth) {
        // Usa fetchWithTokenRefresh per gestire automaticamente il refresh del token se scaduto
        response = await fetchWithTokenRefresh(url, { headers: buildHeaders(true) }, true);
      } else {
        // Accesso pubblico senza autenticazione
        response = await fetch(url, { headers: buildHeaders(false) });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ getShop error:', response.status, errorText);
        // Se è un errore 401 anche dopo il refresh, prova con accesso pubblico
        if (response.status === 401 && hasAuth) {
          console.warn('⚠️ getShop: 401 dopo refresh, provo con accesso pubblico');
          const publicResponse = await fetch(url, { headers: buildHeaders(false) });
          if (publicResponse.ok) {
            const shops = await publicResponse.json();
            if (shops && shops.length > 0) {
              const shop = shops[0];
              persistShopLocally(shop);
              return shop;
            }
          }
        }
        // Se fallisce, restituisci shop di default invece di lanciare errore
        return {
          id: 'default',
          slug: slugToUse,
          name: 'Retro Barbershop',
          address: '',
          postal_code: '',
          city: '',
          province: '',
          phone: '',
          whatsapp: '',
          email: '',
          description: '',
          opening_hours: '',
          extra_opening_date: null,
          extra_morning_start: null,
          extra_morning_end: null,
          extra_afternoon_start: null,
          extra_afternoon_end: null,
          vacation_period: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      const shops = await response.json();

      if (!shops || shops.length === 0) {
        // Se non ci sono shop, crea uno di default
        const defaultShop: Shop = {
          id: 'default',
          slug: slugToUse,
          name: 'Retro Barbershop',
          address: '',
          postal_code: '',
          city: '',
          province: '',
          phone: '',
          whatsapp: '',
          email: '',
          description: '',
          opening_hours: '',
          extra_opening_date: null,
          extra_morning_start: null,
          extra_morning_end: null,
          extra_afternoon_start: null,
          extra_afternoon_end: null,
          vacation_period: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return defaultShop;
      }

      const shopData = shops[0];
      if (!shopData.slug) {
        shopData.slug = slugToUse;
      }
      persistShopLocally(shopData);

      // Parse vacation_period if it's a JSONB string
      // Supabase JSONB columns can come as strings or objects depending on how they're queried
      if (shopData.vacation_period) {
        if (typeof shopData.vacation_period === 'string') {
          try {
            const parsed = JSON.parse(shopData.vacation_period);
            shopData.vacation_period = parsed;
          } catch (e) {
            shopData.vacation_period = null;
          }
        } else if (typeof shopData.vacation_period === 'object') {
          // Already an object, ensure it has the right structure
          if (!shopData.vacation_period.start_date || !shopData.vacation_period.end_date) {
            shopData.vacation_period = null;
          }
        }
      }

      return shopData;
    } catch (error) {
      // Non loggare errori per getShop - è normale se non autenticato
      // Restituisci shop di default
      const fallback = {
        id: 'default',
        slug: slugOverride || getEffectiveSlug(),
        name: 'Retro Barbershop',
        address: '',
        postal_code: '',
        city: '',
        province: '',
        phone: '',
        whatsapp: '',
        email: '',
        description: '',
        opening_hours: '',
        extra_opening_date: null,
        extra_morning_start: null,
        extra_morning_end: null,
        extra_afternoon_start: null,
        extra_afternoon_end: null,
        vacation_period: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      persistShopLocally(fallback);
      return fallback;
    }
  },

  async validateShopInvite(token: string): Promise<{ id: string; token: string; admin_user_id: string | null } | null> {
    if (!isSupabaseConfigured()) {
      console.error('❌ validateShopInvite: Supabase non configurato');
      return null;
    }

    if (!token || token.trim().length === 0) {
      console.error('❌ validateShopInvite: Token vuoto o mancante');
      return null;
    }

    try {
      const nowIso = new Date().toISOString();
      const encodedToken = encodeURIComponent(token.trim());
      const url = `${API_ENDPOINTS.SHOP_INVITES}?select=*&token=eq.${encodedToken}&limit=1`;


      const response = await fetch(url, { headers: buildHeaders(false) });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ validateShopInvite: Errore HTTP:', response.status, errorText);
        return null;
      }

      const invites = await response.json();

      const invite = invites?.[0];
      if (!invite) {
        return null;
      }

      if (invite.used_at) {
        return null;
      }

      if (invite.expires_at && invite.expires_at <= nowIso) {
        return null;
      }


      return {
        id: invite.id,
        token: invite.token,
        admin_user_id: invite.admin_user_id || null
      };
    } catch (error) {
      console.error('❌ validateShopInvite: Errore durante validazione:', error);
      return null;
    }
  },

  async markShopInviteUsed(token: string, shopId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const url = `${API_ENDPOINTS.SHOP_INVITES}?token=eq.${encodeURIComponent(token)}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { ...buildHeaders(true), Prefer: 'return=minimal' },
      body: JSON.stringify({ used_at: new Date().toISOString(), used_by_shop_id: shopId }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Impossibile marcare token come usato: ${response.status} ${text}`);
    }
  },

  async createShop(data: Partial<Shop>): Promise<Shop> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    if (!data.slug || !data.name) throw new Error('Slug e nome sono obbligatori');

    const payload = { ...data };
    payload.slug = slugify(payload.slug || payload.name || DEFAULT_SHOP_SLUG);
    const sendRequest = async (body: Record<string, unknown>) => {
      return fetch(API_ENDPOINTS.SHOPS, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(body),
      });
    };

    let response = await sendRequest(payload);
    if (!response.ok) {
      const text = await response.text();
      const themeColumnMissing = text.toLowerCase().includes('theme_palette');
      if (themeColumnMissing) {
        const { theme_palette: _ignored, ...retryPayload } = payload;
        response = await sendRequest(retryPayload);
      }
      if (!response.ok) {
        throw new Error(`Impossibile creare il negozio: ${response.status} ${text}`);
      }
    }
    const created = await response.json();
    const shop = created?.[0];
    if (shop) persistShopLocally(shop);
    return shop;
  },

  async updateProfileShop(userId: string, shopId: string | null): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const response = await fetch(`${API_ENDPOINTS.PROFILES}?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: { ...buildHeaders(true), Prefer: 'return=minimal' },
      body: JSON.stringify({ shop_id: shopId }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Impossibile aggiornare il profilo con shop_id: ${response.status} ${text}`);
    }
    if (shopId) {
      localStorage.setItem('current_shop_id', shopId);
    }
  },

  // Update shop
  async updateShop(data: Shop): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      // Prepare data for update - ensure vacation_period is properly formatted
      const updateData: any = { ...data };

      // Convert vacation_period to JSON string if it's an object
      if (updateData.vacation_period && typeof updateData.vacation_period === 'object') {
        updateData.vacation_period = JSON.stringify(updateData.vacation_period);
      } else if (updateData.vacation_period === null) {
        updateData.vacation_period = null;
      }

      if (data.id === 'default') {
        // Se è un shop di default, crea un nuovo record
        const { id, ...shopData } = updateData;
        const response = await fetch(API_ENDPOINTS.SHOPS, {
          method: 'POST',
          headers: { ...buildHeaders(true), Prefer: 'return=representation' },
          body: JSON.stringify(shopData),
        });
        if (!response.ok) throw new Error('Failed to create shop');
      } else {
        // Aggiorna shop esistente
        const targetUrl = `${API_ENDPOINTS.SHOPS}?id=eq.${data.id}`;
        const sendUpdate = async (body: Record<string, unknown>) =>
          fetch(targetUrl, {
            method: 'PATCH',
            headers: { ...buildHeaders(true) },
            body: JSON.stringify(body),
          });

        let response = await sendUpdate(updateData);
        if (!response.ok) {
          const errorText = await response.text();
          const themeColumnMissing = errorText.toLowerCase().includes('theme_palette');
          if (themeColumnMissing) {
            const { theme_palette: _ignored, ...retryData } = updateData;
            response = await sendUpdate(retryData);
          }
          if (!response.ok) {
            console.error('Failed to update shop:', response.status, errorText);
            throw new Error(`Failed to update shop: ${response.status} ${errorText}`);
          }
        }
      }
    } catch (error) {
      console.error('Error updating shop:', error);
      throw error;
    }
  },

  // Update shop auto close holidays setting
  async updateShopAutoCloseHolidays(enabled: boolean): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const shop = await this.getShop();
      const updatedShop: Shop = {
        ...shop,
        auto_close_holidays: enabled,
      };
      await this.updateShop(updatedShop);
    } catch (error) {
      console.error('Error updating shop auto close holidays:', error);
      throw error;
    }
  },

  // Update shop vacation period
  async updateShopVacationPeriod(vacationPeriod: VacationPeriod | null): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const shop = await this.getShop();
      const updatedShop: Shop = {
        ...shop,
        vacation_period: vacationPeriod,
      };
      await this.updateShop(updatedShop);
    } catch (error) {
      console.error('Error updating shop vacation period:', error);
      throw error;
    }
  },

  // Chat functions (richiede autenticazione)
  async getChats(): Promise<Chat[]> {
    if (!isSupabaseConfigured()) return [];

    // Non fare chiamata se l'utente non è autenticato
    if (!isAuthenticated()) {
      return [];
    }

    try {
      // CRITICO: Aggiungi filtro esplicito shop_id come doppia sicurezza
      let shopId = getStoredShopId();
      if (!shopId) {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
      }

      // Carica le chat base con filtro shop_id
      let url = `${API_ENDPOINTS.CHATS}?select=*&order=updated_at.desc`;
      if (shopId && shopId !== 'default') {
        url += `&shop_id=eq.${shopId}`;
      }
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) {
        // Se è un errore di autenticazione, non loggare
        if (response.status === 401) {
          return [];
        }
        throw new Error('Failed to fetch chats');
      }
      const chats = await response.json();

      if (!chats || chats.length === 0) {
        return [];
      }

      // Raccogli tutti gli ID unici di clienti e staff
      const clientIds = [...new Set(chats.map((c: any) => c.client_id).filter(Boolean))];
      const staffIds = [...new Set(chats.map((c: any) => c.staff_id).filter(Boolean))];

      // Carica tutti i clienti in una sola query
      // CRITICO: Filtra per shop_id per evitare cross-shop anche se gli ID sono già filtrati dalle chat
      let clientsMap = new Map();
      let clientProfilesMap = new Map();
      if (clientIds.length > 0) {
        try {
          let clientsUrl = `${API_ENDPOINTS.SEARCH_CLIENTS}?select=id,first_name,last_name,photo_url,email,user_id,shop_id&id=in.(${clientIds.join(',')})`;
          if (shopId && shopId !== 'default') {
            clientsUrl += `&shop_id=eq.${shopId}`;
          }
          const clientsResponse = await fetch(clientsUrl, { headers: buildHeaders(true) });
          if (clientsResponse.ok) {
            const clients = await clientsResponse.json();
            clients.forEach((client: any) => {
              clientsMap.set(client.id, client);
            });

            // Se alcuni clienti hanno user_id, recupera le foto profilo dalla tabella profiles
            // CRITICO: Filtra per shop_id anche per i profili per evitare cross-shop
            const clientUserIds = [...new Set(clients.map((c: any) => c.user_id).filter(Boolean))];
            if (clientUserIds.length > 0) {
              try {
                let profilesUrl = `${API_ENDPOINTS.PROFILES}?select=user_id,profile_photo_url,shop_id&user_id=in.(${clientUserIds.join(',')})`;
                if (shopId && shopId !== 'default') {
                  profilesUrl += `&shop_id=eq.${shopId}`;
                }
                const profilesResponse = await fetch(profilesUrl, { headers: buildHeaders(true) });
                if (profilesResponse.ok) {
                  const profiles = await profilesResponse.json();
                  profiles.forEach((profile: any) => {
                    if (profile.user_id) {
                      clientProfilesMap.set(profile.user_id, profile.profile_photo_url || null);
                    }
                  });
                }
              } catch (profileError) {
                console.error('Error loading client profile photos:', profileError);
              }
            }
          }
        } catch (error) {
          console.error('Error loading clients:', error);
        }
      }

      // Carica tutti gli staff in una sola query
      // CRITICO: Filtra per shop_id per evitare cross-shop anche se gli ID sono già filtrati dalle chat
      let staffMap = new Map();
      if (staffIds.length > 0) {
        try {
          let staffUrl = `${API_ENDPOINTS.STAFF}?select=id,full_name,profile_photo_url,shop_id&id=in.(${staffIds.join(',')})`;
          if (shopId && shopId !== 'default') {
            staffUrl += `&shop_id=eq.${shopId}`;
          }
          const staffResponse = await fetch(staffUrl, { headers: buildHeaders(true) });
          if (staffResponse.ok) {
            const staffList = await staffResponse.json();
            staffList.forEach((staff: any) => {
              staffMap.set(staff.id, staff);
            });
          }
        } catch (error) {
          console.error('Error loading staff:', error);
        }
      }

      // Per ogni chat, carica l'ultimo messaggio e il conteggio non letti, e aggiungi i dati cliente/staff
      const chatsWithDetails = await Promise.all(
        chats.map(async (chat: any) => {
          // Ottieni dati cliente
          const clientData = clientsMap.get(chat.client_id);
          const clientName = clientData
            ? `${clientData.first_name || ''} ${clientData.last_name || ''}`.trim() || clientData.email || 'Cliente'
            : 'Cliente';
          const clientProfilePhoto = clientData?.user_id ? clientProfilesMap.get(clientData.user_id) : null;

          // Ottieni dati staff
          const staffData = staffMap.get(chat.staff_id);
          const staffName = staffData?.full_name || 'Barbiere';

          // Carica l'ultimo messaggio
          let lastMessage: any = undefined;
          let unreadCount = 0;

          try {
            const messagesUrl = `${API_ENDPOINTS.CHAT_MESSAGES}?select=id,content,sender_type,sender_id,created_at,read_at&chat_id=eq.${chat.id}&order=created_at.desc&limit=1`;
            const messagesResponse = await fetch(messagesUrl, { headers: buildHeaders(true) });
            if (messagesResponse.ok) {
              const messages = await messagesResponse.json();
              if (messages && messages.length > 0) {
                lastMessage = messages[0];
              }
            }

            // Conta i messaggi non letti
            const unreadUrl = `${API_ENDPOINTS.CHAT_MESSAGES}?select=id&chat_id=eq.${chat.id}&read_at=is.null`;
            const unreadResponse = await fetch(unreadUrl, { headers: buildHeaders(true) });
            if (unreadResponse.ok) {
              const unreadMessages = await unreadResponse.json();
              unreadCount = unreadMessages?.length || 0;
            }
          } catch (error) {
            console.error('Error loading chat details:', error);
          }

          return {
            id: chat.id,
            client_id: chat.client_id,
            staff_id: chat.staff_id,
            created_at: chat.created_at,
            updated_at: chat.updated_at,
            client_name: clientName,
            client_photo: clientData?.photo_url || clientProfilePhoto || undefined,
            staff_name: staffName,
            staff_photo: staffData?.profile_photo_url || undefined,
            unread_count: unreadCount,
            last_message: lastMessage || undefined,
          };
        })
      );

      return chatsWithDetails;
    } catch (error) {
      // Non loggare errori di autenticazione
      if (isAuthError(error)) {
        return [];
      }
      console.error('Error fetching chats:', error);
      return [];
    }
  },

  async getMessages(chatId: string): Promise<ChatMessage[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      // CRITICO: Aggiungi filtro esplicito shop_id come doppia sicurezza
      // Recupera shop_id dal chat per validazione
      let shopId = getStoredShopId();
      if (!shopId) {
        // Prova a recuperare shop_id dal chat
        try {
          const chatUrl = `${API_ENDPOINTS.CHATS}?id=eq.${chatId}&select=shop_id&limit=1`;
          const chatResponse = await fetch(chatUrl, { headers: buildHeaders(true) });
          if (chatResponse.ok) {
            const chats = await chatResponse.json();
            if (chats && chats.length > 0 && chats[0].shop_id) {
              shopId = chats[0].shop_id;
            }
          }
        } catch (e) {
          // Se fallisce, usa shop corrente
          const shop = await this.getShop();
          shopId = shop?.id ?? null;
        }
      }

      let url = `${API_ENDPOINTS.CHAT_MESSAGES}?select=*&chat_id=eq.${chatId}&order=created_at.asc`;
      if (shopId && shopId !== 'default') {
        url += `&shop_id=eq.${shopId}`;
      }
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) throw new Error('Failed to fetch messages');
      return await response.json();
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  },

  async sendMessage(data: CreateMessageRequest): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(API_ENDPOINTS.CHAT_MESSAGES, {
        method: 'POST',
        headers: { ...buildHeaders(true) },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to send message: ${response.status} ${errorText || ''}`.trim());
      }
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  },

  async findChatByParticipants(clientId: string, staffId: string): Promise<Chat | null> {
    if (!isSupabaseConfigured()) return null;
    if (!isAuthenticated()) {
      return null;
    }

    try {
      // CRITICO: Filtra per shop_id per evitare cross-shop
      let shopId = getStoredShopId();
      if (!shopId) {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
      }

      let url = `${API_ENDPOINTS.CHATS}?select=*&client_id=eq.${clientId}&staff_id=eq.${staffId}&limit=1`;
      if (shopId && shopId !== 'default') {
        url += `&shop_id=eq.${shopId}`;
      }
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) {
        return null;
      }
      const chatsData = await response.json();
      return chatsData?.[0] || null;
    } catch (error) {
      console.error('Error searching chat by participants:', error);
      return null;
    }
  },

  async createChat(data: CreateChatRequest): Promise<Chat> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(API_ENDPOINTS.CHATS, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create chat: ${response.status} ${errorText}`);
      }
      const created = await response.json();
      if (!created || !created[0]) {
        throw new Error('Chat creation returned no data');
      }
      return created[0];
    } catch (error) {
      console.error('Error creating chat:', error);
      throw error;
    }
  },

  async deleteChat(chatId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    try {
      const response = await fetch(`${API_ENDPOINTS.CHATS}?id=eq.${chatId}`, {
        method: 'DELETE',
        headers: { ...buildHeaders(true) },
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Failed to delete chat: ${response.status} ${err}`);
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      throw error;
    }
  },

  async markMessagesAsRead(chatId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(`${API_ENDPOINTS.CHAT_MESSAGES}?chat_id=eq.${chatId}`, {
        method: 'PATCH',
        headers: { ...buildHeaders(true) },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error('Failed to mark messages as read');
    } catch (error) {
      console.error('Error marking messages as read:', error);
      throw error;
    }
  },

  // Get all services
  async getServices(): Promise<Service[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      // CRITICO: Aggiungi filtro esplicito shop_id come doppia sicurezza
      let shopId = getStoredShopId();

      if (!shopId || shopId === 'default') {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
        // Assicurati che lo shop_id sia salvato nel localStorage
        if (shopId && shopId !== 'default' && typeof window !== 'undefined') {
          localStorage.setItem('current_shop_id', shopId);
        }
      }

      // Mostra tutti i servizi (attivi e non), ordinati per nome
      // Permetti accesso pubblico (buildHeaders(false)) per permettere ai clienti non autenticati di vedere i servizi
      // Il filtro shop_id nella query assicura che vedano solo i servizi del negozio corretto
      let url = `${API_ENDPOINTS.SERVICES}?select=*&order=name.asc&active=eq.true`;
      if (shopId && shopId !== 'default') {
        url += `&shop_id=eq.${shopId}`;
      } else {
      }

      // Prova prima con autenticazione, poi fallback a pubblico
      const hasAuth = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

      let response: Response;
      if (hasAuth) {
        // Usa fetchWithTokenRefresh per gestire automaticamente il refresh del token se scaduto
        response = await fetchWithTokenRefresh(url, { headers: buildHeaders(true) }, true);
      } else {
        // Accesso pubblico senza autenticazione
        response = await fetch(url, { headers: buildHeaders(false) });
      }

      if (!response.ok) {
        const errorText = await response.text();
        // Se è un errore 401 anche dopo il refresh, prova con accesso pubblico
        if (response.status === 401 && hasAuth) {
          console.warn('⚠️ getServices: 401 dopo refresh, provo con accesso pubblico');
          const publicResponse = await fetch(url, { headers: buildHeaders(false) });
          if (publicResponse.ok) {
            return await publicResponse.json();
          }
        }
        console.error('❌ getServices: Errore nella risposta:', response.status, errorText);
        throw new Error(`Failed to fetch services: ${response.status} ${errorText}`);
      }

      const services = await response.json();
      return services;
    } catch (error) {
      // Se l'errore è di tipo network (ERR_INSUFFICIENT_RESOURCES), non loggare
      // per evitare spam nella console
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('⚠️ Network error in getServices (likely ERR_INSUFFICIENT_RESOURCES), returning empty array');
        return [];
      }
      console.error('❌ Error fetching services:', error);
      return [];
    }
  },

  // Get all staff (pubblico per permettere ai clienti di vedere i barbieri disponibili)
  async getStaff(): Promise<Staff[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      // CRITICO: Aggiungi filtro esplicito shop_id come doppia sicurezza
      let shopId = getStoredShopId();

      if (!shopId || shopId === 'default') {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
        // Assicurati che lo shop_id sia salvato nel localStorage
        if (shopId && shopId !== 'default' && typeof window !== 'undefined') {
          localStorage.setItem('current_shop_id', shopId);
        }
      }

      // Permetti accesso pubblico (buildHeaders(false)) per permettere ai clienti non autenticati di vedere lo staff
      // Il filtro shop_id nella query assicura che vedano solo lo staff del negozio corretto
      let url = `${API_ENDPOINTS.STAFF}?select=*&order=full_name.asc&active=eq.true`;
      if (shopId && shopId !== 'default') {
        url += `&shop_id=eq.${shopId}`;
      } else {
      }

      // Prova prima con autenticazione, poi fallback a pubblico
      const hasAuth = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');

      let response: Response;
      if (hasAuth) {
        // Usa fetchWithTokenRefresh per gestire automaticamente il refresh del token se scaduto
        response = await fetchWithTokenRefresh(url, { headers: buildHeaders(true) }, true);
      } else {
        // Accesso pubblico senza autenticazione
        response = await fetch(url, { headers: buildHeaders(false) });
      }

      if (!response.ok) {
        const errorText = await response.text();
        // Se è un errore 401 anche dopo il refresh, prova con accesso pubblico
        if (response.status === 401 && hasAuth) {
          console.warn('⚠️ getStaff: 401 dopo refresh, provo con accesso pubblico');
          const publicResponse = await fetch(url, { headers: buildHeaders(false) });
          if (publicResponse.ok) {
            return await publicResponse.json();
          }
        }
        console.error('❌ getStaff: Errore nella risposta:', response.status, errorText);
        // Se fallisce, restituisci array vuoto invece di loggare errore
        return [];
      }

      const staff = await response.json();
      return staff;
    } catch (error) {
      // Se l'errore è di tipo network (ERR_INSUFFICIENT_RESOURCES), non loggare
      // per evitare spam nella console
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        console.warn('⚠️ Network error in getStaff (likely ERR_INSUFFICIENT_RESOURCES), returning empty array');
        return [];
      }
      console.error('❌ Error fetching staff:', error);
      return [];
    }
  },

  // Create new staff member
  async createStaff(staffData: Omit<Staff, 'id' | 'created_at'>): Promise<Staff> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      // Se shop_id è passato esplicitamente, usalo (può essere null per indicare "non assegnato")
      // Altrimenti prova a ottenere lo shop_id dal contesto corrente
      let shopId: string | null = null;

      if (staffData.shop_id !== undefined) {
        // shop_id è stato passato esplicitamente (può essere null o un valore)
        shopId = staffData.shop_id;
      } else {
        // shop_id non è stato passato, prova a ottenerlo dal contesto
        const storedShopId = getStoredShopId();
        if (storedShopId && storedShopId !== '1' && storedShopId !== 'default') {
          shopId = storedShopId;
        } else {
          try {
            const shop = await this.getShop();
            shopId = shop?.id || null;
          } catch {
            shopId = null; // Se non riesce a ottenere lo shop, lascia null
          }
        }
      }

      // Invia solo i campi che esistono nella tabella staff del DB
      const payload: Record<string, any> = {
        full_name: staffData.full_name,
        role: staffData.role,
        active: staffData.active ?? true,
      };

      // Aggiungi shop_id solo se è un UUID valido (può essere null esplicitamente)
      // Non aggiungere shop_id se è '1' o 'default' (valori di default non validi)
      if (shopId && shopId !== '1' && shopId !== 'default') {
        // Verifica che sia un UUID valido (formato base)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(shopId)) {
          payload.shop_id = shopId;
        } else {
          payload.shop_id = null;
        }
      } else if (shopId === null) {
        // shop_id è null esplicitamente, aggiungilo come null per essere chiari
        payload.shop_id = null;
      } else {
      }

      // Aggiungi campi opzionali solo se hanno un valore
      if (staffData.calendar_id) payload.calendar_id = staffData.calendar_id;
      if (staffData.email) payload.email = staffData.email;
      if (staffData.phone) payload.phone = staffData.phone;
      if ((staffData as any).chair_id) payload.chair_id = (staffData as any).chair_id;
      if ((staffData as any).user_id) payload.user_id = (staffData as any).user_id;

      const response = await fetch(API_ENDPOINTS.STAFF, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create staff: ${response.status} ${errorText}`);
      }

      const created = await response.json();
      const createdStaff = created[0] as Staff;

      // Se lo staff è stato creato con un user_id, aggiorna profiles.role a 'barber'
      if ((staffData as any).user_id) {
        try {
          // Verifica se il profilo esiste e non è già 'admin' (mantieni gli admin)
          const profileCheckRes = await fetch(`${API_ENDPOINTS.PROFILES}?user_id=eq.${(staffData as any).user_id}&select=role&limit=1`, {
            headers: { ...buildHeaders(true) },
          });

          if (profileCheckRes.ok) {
            const profiles = await profileCheckRes.json();
            const existingProfile = profiles[0];

            // Aggiorna solo se il ruolo non è già 'barber' o 'admin'
            if (existingProfile && existingProfile.role !== 'barber' && existingProfile.role !== 'admin') {
              await fetch(`${API_ENDPOINTS.PROFILES}?user_id=eq.${(staffData as any).user_id}`, {
                method: 'PATCH',
                headers: { ...buildHeaders(true), Prefer: 'return=minimal' },
                body: JSON.stringify({
                  role: 'barber',
                  updated_at: new Date().toISOString(),
                }),
              });
            }
          }
        } catch (profileError) {
          // Non bloccare la creazione dello staff se l'aggiornamento del profilo fallisce
          console.warn('⚠️ Impossibile aggiornare profiles.role per staff creato:', profileError);
        }
      }

      return createdStaff;
    } catch (error) {
      console.error('Error creating staff:', error);
      throw error;
    }
  },

  // Update existing staff member
  async updateStaff(id: string, staffData: Partial<Staff>): Promise<Staff> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      // Recupera lo staff esistente per verificare se user_id è cambiato
      let oldUserId: string | null = null;
      const newUserId = (staffData as any).user_id;

      if (newUserId !== undefined) {
        try {
          const existingStaffRes = await fetch(`${API_ENDPOINTS.STAFF}?id=eq.${id}&select=user_id&limit=1`, {
            headers: { ...buildHeaders(true) },
          });
          if (existingStaffRes.ok) {
            const existingStaff = await existingStaffRes.json();
            if (existingStaff[0]) {
              oldUserId = existingStaff[0].user_id || null;
            }
          }
        } catch (e) {
          // Ignora errori nel recupero dello staff esistente
        }
      }

      // Filtra solo i campi che esistono nel DB (incluso chair_id per assegnazione poltrone)
      const dbFields = ['shop_id', 'full_name', 'role', 'calendar_id', 'active', 'email', 'phone', 'chair_id', 'profile_photo_url', 'specialties', 'bio'];
      const payload: Record<string, any> = {};

      for (const key of dbFields) {
        if (key in staffData) {
          payload[key] = (staffData as any)[key];
        }
      }

      // Aggiungi user_id se presente
      if (newUserId !== undefined) {
        payload.user_id = newUserId;
      }

      // Se non ci sono campi da aggiornare nel DB, ritorna
      if (Object.keys(payload).length === 0) {
        return { id, ...staffData } as Staff;
      }

      const response = await fetch(`${API_ENDPOINTS.STAFF}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update staff: ${response.status} ${errorText}`);
      }

      const updated = await response.json();
      const updatedStaff = { ...updated[0], ...staffData } as Staff;

      // Se user_id è stato aggiunto o modificato, aggiorna profiles.role a 'barber'
      if (newUserId !== undefined && newUserId !== null && newUserId !== oldUserId) {
        try {
          // Verifica se il profilo esiste e non è già 'admin' (mantieni gli admin)
          const profileCheckRes = await fetch(`${API_ENDPOINTS.PROFILES}?user_id=eq.${newUserId}&select=role&limit=1`, {
            headers: { ...buildHeaders(true) },
          });

          if (profileCheckRes.ok) {
            const profiles = await profileCheckRes.json();
            const existingProfile = profiles[0];

            // Aggiorna solo se il ruolo non è già 'barber' o 'admin'
            if (existingProfile && existingProfile.role !== 'barber' && existingProfile.role !== 'admin') {
              await fetch(`${API_ENDPOINTS.PROFILES}?user_id=eq.${newUserId}`, {
                method: 'PATCH',
                headers: { ...buildHeaders(true), Prefer: 'return=minimal' },
                body: JSON.stringify({
                  role: 'barber',
                  updated_at: new Date().toISOString(),
                }),
              });
            }
          }
        } catch (profileError) {
          // Non bloccare l'aggiornamento dello staff se l'aggiornamento del profilo fallisce
          console.warn('⚠️ Impossibile aggiornare profiles.role per staff aggiornato:', profileError);
        }
      }

      return updatedStaff;
    } catch (error) {
      console.error('Error updating staff:', error);
      throw error;
    }
  },

  // Delete staff member
  async deleteStaff(id: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(`${API_ENDPOINTS.STAFF}?id=eq.${id}`, {
        method: 'DELETE',
        headers: { ...buildHeaders(true) },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete staff: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error('Error deleting staff:', error);
      throw error;
    }
  },

  // Get all products
  async getProducts(): Promise<Product[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      // CRITICO: Aggiungi filtro esplicito shop_id come doppia sicurezza
      let shopId = getStoredShopId();
      if (!shopId || shopId === 'default') {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
        // Assicurati che lo shop_id sia salvato nel localStorage
        if (shopId && shopId !== 'default' && typeof window !== 'undefined') {
          localStorage.setItem('current_shop_id', shopId);
        }
      }

      // Filtra sempre per prodotti attivi
      // IMPORTANTE: Filtra SOLO per shop_id specifico per evitare di mostrare prodotti di altri negozi
      let url = `${API_ENDPOINTS.PRODUCTS}?select=*&order=name.asc&active=eq.true`;
      if (shopId && shopId !== 'default') {
        // Mostra SOLO prodotti del negozio specifico
        url += `&shop_id=eq.${shopId}`;
      } else {
        // Se non c'è shop_id, mostra solo prodotti senza shop_id (prodotti globali)
        // Questo evita di mostrare prodotti di altri negozi
        url += `&shop_id=is.null`;
      }

      console.log('🛍️ getProducts: Fetching products', {
        shopId,
        url,
        hasShopIdFilter: shopId && shopId !== 'default'
      });

      // Usa fetchWithTokenRefresh per gestire automaticamente il refresh del token se scaduto
      const hasAuth = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      let response: Response;
      if (hasAuth) {
        response = await fetchWithTokenRefresh(url, { headers: buildHeaders(true) }, true);
      } else {
        // Accesso pubblico senza autenticazione
        response = await fetch(url, { headers: buildHeaders(false) });
      }

      if (!response.ok) {
        // Se è un errore 401 anche dopo il refresh, prova con accesso pubblico
        if (response.status === 401 && hasAuth) {
          console.warn('⚠️ getProducts: 401 dopo refresh, provo con accesso pubblico');
          const publicResponse = await fetch(url, { headers: buildHeaders(false) });
          if (publicResponse.ok) {
            const products = await publicResponse.json();
            console.log('🛍️ getProducts: Loaded products (public):', products.length, products);
            return products;
          }
        }
        throw new Error('Failed to fetch products');
      }
      const products = await response.json();
      console.log('🛍️ getProducts: Loaded products:', products.length);
      console.log('🛍️ getProducts: Products details:', products.map((p: any) => ({
        id: p.id,
        name: p.name,
        shop_id: p.shop_id,
        price: p.price,
        price_cents: p.price_cents,
        image_url: p.image_url,
        imageurl: p.imageurl,
        active: p.active
      })));

      // Normalizza i prodotti: gestisci sia image_url che imageurl
      const normalizedProducts = products.map((p: any) => {
        const normalized: any = { ...p };
        // Se ha imageurl ma non image_url, copia in image_url
        if (p.imageurl && !p.image_url) {
          normalized.image_url = p.imageurl;
        }
        // Se ha image_url ma non imageurl, copia in imageurl per compatibilità
        if (p.image_url && !p.imageurl) {
          normalized.imageurl = p.image_url;
        }
        return normalized;
      });

      return normalizedProducts;
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  },

  // Create product
  async createProduct(productData: Partial<Product>): Promise<Product> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      // Assicurati che shop_id sia presente
      let shopId = (productData as any).shop_id || getStoredShopId();
      if (!shopId || shopId === 'default') {
        try {
          const shop = await this.getShop();
          shopId = shop?.id ?? null;
        } catch (shopError) {
        }
      }

      const payload = {
        ...productData,
        shop_id: shopId && shopId !== 'default' ? shopId : undefined,
        active: true,
      } as any;

      const response = await fetch(API_ENDPOINTS.PRODUCTS, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let detail = '';
        try { detail = await response.text(); } catch { }
        throw new Error(`Failed to create product: ${response.status} ${detail}`);
      }
      const products = await response.json();
      return products[0];
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  },

  // Update product
  async updateProduct(id: string, productData: Partial<Product>): Promise<Product> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const payload = { ...(productData as any) } as any;
      const response = await fetch(`${API_ENDPOINTS.PRODUCTS}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let detail = '';
        try { detail = await response.text(); } catch { }
        throw new Error(`Failed to update product: ${response.status} ${detail}`);
      }
      const products = await response.json();
      return products[0];
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  },

  // Delete product
  async deleteProduct(id: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(`${API_ENDPOINTS.PRODUCTS}?id=eq.${id}`, {
        method: 'DELETE',
        headers: { ...buildHeaders(true) },
      });
      if (!response.ok) throw new Error('Failed to delete product');
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  },

  // ============================================
  // Notifications
  // ============================================

  // Get notifications for current user (richiede autenticazione)
  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    if (!isSupabaseConfigured()) return [];

    // Non fare chiamata se l'utente non è autenticato
    if (!isAuthenticated()) {
      return [];
    }

    try {
      const url = `${API_ENDPOINTS.NOTIFICATIONS}?user_id=eq.${userId}&order=created_at.desc&limit=${limit}`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) {
        // Se è un errore di autenticazione, non loggare
        if (response.status === 401) {
          return [];
        }
        throw new Error('Failed to fetch notifications');
      }
      return await response.json();
    } catch (error) {
      // Non loggare errori di autenticazione
      if (isAuthError(error)) {
        return [];
      }
      // Non loggare altri errori - restituisci array vuoto silenziosamente
      return [];
    }
  },

  // Get unread notifications count (richiede autenticazione)
  async getUnreadNotificationsCount(userId: string): Promise<number> {
    if (!isSupabaseConfigured()) return 0;

    // Non fare chiamata se l'utente non è autenticato
    if (!isAuthenticated()) {
      return 0;
    }

    try {
      const url = `${API_ENDPOINTS.NOTIFICATIONS}?user_id=eq.${userId}&read_at=is.null&select=id`;
      const response = await fetch(url, {
        headers: { ...buildHeaders(true), 'Prefer': 'count=exact' }
      });
      if (!response.ok) {
        // Se è un errore di autenticazione, non loggare
        if (response.status === 401) {
          return 0;
        }
        throw new Error('Failed to fetch notifications count');
      }

      // Supabase returns count in content-range header
      const contentRange = response.headers.get('content-range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)/);
        if (match) return parseInt(match[1], 10);
      }

      // Fallback: count from response
      const data = await response.json();
      return Array.isArray(data) ? data.length : 0;
    } catch (error) {
      // Non loggare errori di autenticazione
      if (isAuthError(error)) {
        return 0;
      }
      // Non loggare altri errori - restituisci 0 silenziosamente
      return 0;
    }
  },

  // Mark notification as read
  async markNotificationAsRead(notificationId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}?id=eq.${notificationId}`, {
        method: 'PATCH',
        headers: buildHeaders(true),
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  },

  // Mark all notifications as read for a user
  async markAllNotificationsAsRead(userId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}?user_id=eq.${userId}&read_at=is.null`, {
        method: 'PATCH',
        headers: buildHeaders(true),
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error('Failed to mark all notifications as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  },

  // Delete a notification
  async deleteNotification(notificationId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const headers = buildHeaders(true);
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}?id=eq.${notificationId}`, {
        method: 'DELETE',
        headers: { ...headers, Prefer: 'return=minimal' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore DELETE notifica:', response.status, errorText);
        throw new Error(`Failed to delete notification: ${response.status} ${errorText}`);
      }

      // Notification deleted successfully
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  },

  // Delete all notifications for current user
  async deleteAllNotifications(userId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const headers = buildHeaders(true);
      const url = `${API_ENDPOINTS.NOTIFICATIONS}?user_id=eq.${userId}`;
      const response = await fetchWithTokenRefresh(url, {
        method: 'DELETE',
        headers: { ...headers, Prefer: 'return=minimal' },
      }, true);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore DELETE tutte notifiche:', response.status, errorText);
        throw new Error(`Failed to delete all notifications: ${response.status} ${errorText}`);
      }

      // All notifications deleted successfully
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      throw error;
    }
  },

  // ============================================
  // Client Appointment Cancellation
  // ============================================

  // Cancel appointment directly in Supabase (for client cancellations)
  async cancelAppointmentDirect(appointmentId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      // Usa buildHeaders(true) per avere i permessi di aggiornamento con token utente
      const response = await fetch(`${API_ENDPOINTS.APPOINTMENTS_FEED}?id=eq.${appointmentId}`, {
        method: 'PATCH',
        headers: { ...buildHeaders(true), Prefer: 'return=minimal' },
        body: JSON.stringify({
          status: 'cancelled',
          updated_at: new Date().toISOString()
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore cancellazione appuntamento:', response.status, errorText);
        throw new Error(`Failed to cancel appointment: ${response.status} ${errorText}`);
      }

      // Appointment cancelled successfully
    } catch (error) {
      console.error('❌ Errore critico cancellazione appuntamento:', error);
      throw error;
    }
  },

  // Delete appointment completely from Supabase (for barber deletions)
  async deleteAppointmentDirect(appointmentId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      // Usa buildHeaders(true) per avere i permessi di eliminazione con token utente
      const response = await fetch(`${API_ENDPOINTS.APPOINTMENTS_FEED}?id=eq.${appointmentId}`, {
        method: 'DELETE',
        headers: { ...buildHeaders(true), Prefer: 'return=minimal' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore eliminazione appuntamento:', response.status, errorText);
        throw new Error(`Failed to delete appointment: ${response.status} ${errorText}`);
      }

      // Appointment deleted successfully
    } catch (error) {
      console.error('❌ Errore critico eliminazione appuntamento:', error);
      throw error;
    }
  },

  // Create a notification for a user
  async createNotification(data: {
    user_id: string;
    user_type: 'staff' | 'client';
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<Notification | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      let shopId = getStoredShopId();
      if (!shopId) {
        const shop = await this.getShop();
        shopId = shop?.id ?? null;
      }

      const payload = {
        shop_id: shopId && shopId !== 'default' ? shopId : null,
        user_id: data.user_id,
        user_type: data.user_type,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {},
      };

      const response = await fetchWithTokenRefresh(
        API_ENDPOINTS.NOTIFICATIONS,
        {
          method: 'POST',
          headers: { ...buildHeaders(true), Prefer: 'return=representation' },
          body: JSON.stringify(payload),
        },
        true
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore creazione notifica:', response.status);
        console.error('❌ Dettaglio errore:', errorText);
        console.error('❌ Payload inviato:', JSON.stringify(payload, null, 2));

        // Se è un errore 403, probabilmente è un problema di RLS policy
        if (response.status === 403) {
          console.error('❌ ERRORE RLS: La policy di Supabase non permette l\'inserimento. Esegui lo script SQL per aggiornare le policies.');
        }
        // Se è un errore 400, potrebbe essere un problema con il tipo di notifica
        if (response.status === 400) {
          console.error('❌ ERRORE DATI: Controlla che il tipo di notifica sia valido nel database.');
        }
        return null;
      }

      const created = await response.json();
      return created[0];
    } catch (error) {
      console.error('❌ Errore critico creazione notifica:', error);
      return null;
    }
  },

  // Get staff member by ID
  async getStaffById(staffId: string): Promise<Staff | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      const url = `${API_ENDPOINTS.STAFF}?id=eq.${staffId}&select=*&limit=1`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) return null;
      const staff = await response.json();
      return staff[0] || null;
    } catch (error) {
      console.error('Error fetching staff by id:', error);
      return null;
    }
  },

  // Get staff member by linked auth user id
  async getStaffByUserId(userId: string): Promise<Staff | null> {
    if (!isSupabaseConfigured()) return null;
    if (!userId) return null;

    try {
      const url = `${API_ENDPOINTS.STAFF}?user_id=eq.${userId}&select=*&limit=1`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) {
        return null;
      }
      const staff = await response.json();
      return staff[0] || null;
    } catch (error) {
      console.error('Error fetching staff by user id:', error);
      return null;
    }
  },

  // Get appointment by ID with full details
  async getAppointmentById(appointmentId: string): Promise<Appointment | null> {
    if (!isSupabaseConfigured()) return null;

    try {
      // Includi user_id nello staff per le notifiche
      const url = `${API_ENDPOINTS.APPOINTMENTS_FEED}?id=eq.${appointmentId}&select=*,clients(first_name,last_name,phone_e164,email),staff(id,full_name,email,user_id),services(id,name,duration_min)&limit=1`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) return null;
      const appointments = await response.json();
      return appointments[0] || null;
    } catch (error) {
      console.error('Error fetching appointment by id:', error);
      return null;
    }
  },

  // ============================================
  // Waitlist - "Avvisami se si libera un posto prima" (collegata ad appuntamenti)
  // ============================================

  // Enable waitlist for an existing appointment (earlier slot notifications)
  async joinWaitlist(data: JoinWaitlistRequest): Promise<WaitlistEntry | null> {
    if (!isSupabaseConfigured()) {
      return null;
    }

    try {
      // Expire at: default = appointment start (passed by caller) or 30 days
      const expiresAt =
        data.expires_at ||
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const payload = {
        shop_id: data.shop_id,
        client_id: data.client_id,
        staff_id: data.staff_id,
        appointment_id: data.appointment_id,
        appointment_duration_min: data.appointment_duration_min,
        notify_if_earlier: data.notify_if_earlier ?? true,
        status: 'active',
        expires_at: expiresAt,
        notes: data.notes || null,
      };

      const response = await fetch(API_ENDPOINTS.WAITLIST, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Errore inserimento in waitlist:', response.status, errorText);
        throw new Error(`Failed to join waitlist: ${response.status} ${errorText}`);
      }

      const created = await response.json();
      return created[0];
    } catch (error) {
      console.error('❌ Errore critico inserimento in waitlist:', error);
      throw error;
    }
  },

  // Disable waitlist entry (delete)
  async leaveWaitlist(waitlistId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const response = await fetch(`${API_ENDPOINTS.WAITLIST}?id=eq.${waitlistId}`, {
        method: 'DELETE',
        headers: buildHeaders(true),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to leave waitlist: ${response.status} ${errorText}`);
      }

      // Waitlist entry removed successfully
    } catch (error) {
      console.error('❌ Errore rimozione da waitlist:', error);
      throw error;
    }
  },

  // Get client's active waitlist entries (for upcoming appointments)
  async getClientWaitlistStatus(clientId: string): Promise<WaitlistEntry[]> {
    if (!isSupabaseConfigured()) return [];

    try {
      // Active / notified entries that haven't expired
      const url =
        `${API_ENDPOINTS.WAITLIST}` +
        `?client_id=eq.${clientId}` +
        `&status=in.(active,notified)` +
        `&expires_at=gte.${new Date().toISOString()}` +
        `&select=*,staff(id,full_name),appointments:appointment_id(id,start_at,end_at,service_id,services(id,name,duration_min))` +
        `&order=created_at.desc`;
      const response = await fetch(url, { headers: buildHeaders(true) });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Errore fetch waitlist status:', response.status, errorText);
        return [];
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching waitlist status:', error);
      return [];
    }
  },

  // Update waitlist entry status
  async updateWaitlistStatus(waitlistId: string, status: 'active' | 'notified' | 'accepted' | 'expired' | 'disabled'): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    try {
      const payload: Record<string, unknown> = { status };
      if (status === 'notified') {
        payload.notified_at = new Date().toISOString();
      }

      const response = await fetch(`${API_ENDPOINTS.WAITLIST}?id=eq.${waitlistId}`, {
        method: 'PATCH',
        headers: { ...buildHeaders(true), Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update waitlist status: ${response.status} ${errorText}`);
      }

      // Waitlist status updated successfully
    } catch (error) {
      console.error('❌ Errore aggiornamento stato waitlist:', error);
      throw error;
    }
  },

  // Check if client is already subscribed for the given appointment
  async isClientInWaitlist(clientId: string, appointmentId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;

    try {
      const url =
        `${API_ENDPOINTS.WAITLIST}` +
        `?client_id=eq.${clientId}` +
        `&appointment_id=eq.${appointmentId}` +
        `&status=in.(active,notified)` +
        `&select=id&limit=1`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) return false;
      const json = await response.json();
      return Array.isArray(json) && json.length > 0;
    } catch (error) {
      console.error('Error checking waitlist:', error);
      return false;
    }
  },

  // Convenience: accept earlier slot offer (update appointment + update waitlist)
  async acceptEarlierSlotOffer(params: {
    waitlistId: string;
    appointmentId: string;
    staffId: string;
    serviceId: string;
    earlierStartAt: string;
    earlierEndAt: string;
  }): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');

    // 1) Move appointment (overlap checked inside updateAppointmentDirect)
    await this.updateAppointmentDirect({
      id: params.appointmentId,
      staff_id: params.staffId,
      service_id: params.serviceId,
      start_at: params.earlierStartAt,
      end_at: params.earlierEndAt,
      status: 'rescheduled',
    });

    // 2) Mark waitlist as accepted
    await this.updateWaitlistStatus(params.waitlistId, 'accepted');

    // 3) Trigger email workflow (non-blocking)
    this.triggerAppointmentModifiedHook({
      id: params.appointmentId,
      staff_id: params.staffId,
      service_id: params.serviceId,
      start_at: params.earlierStartAt,
      end_at: params.earlierEndAt,
      status: 'rescheduled',
    });
  },

  async declineEarlierSlotOffer(waitlistId: string): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    // Reset to active so the client can receive future earlier offers
    await this.updateWaitlistStatus(waitlistId, 'active');
  },
};