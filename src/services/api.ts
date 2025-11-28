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
  WaitlistEntry,
  JoinWaitlistRequest
} from '../types';
import { createDefaultShopHoursConfig, formatTimeToHHMM, normalizeTimeString } from '../utils/shopHours';

// Check if Supabase is configured
const isSupabaseConfigured = () => {
  return API_CONFIG.SUPABASE_EDGE_URL && API_CONFIG.SUPABASE_ANON_KEY;
};

// Helper per verificare se l'utente è autenticato
const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('auth_token');
  const user = localStorage.getItem('auth_user');
  return !!(token && user);
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
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken || !isSupabaseConfigured()) {
    return false;
  }

  try {
    console.log('🔄 API: Tentativo refresh token...');
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
      localStorage.setItem('auth_token', tokenJson.access_token);
      if (tokenJson.refresh_token) {
        localStorage.setItem('refresh_token', tokenJson.refresh_token);
      }
      console.log('✅ API: Token refreshato con successo');
      return true;
    }
    
    console.log('❌ API: Refresh token fallito');
    return false;
  } catch (error) {
    console.error('❌ API: Errore refresh token:', error);
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
  
  // Se errore 401 e usaAuth, prova a refreshare il token e riprova
  if (response.status === 401 && useAuth) {
    const responseText = await response.clone().text();
    if (responseText.includes('JWT expired') || responseText.includes('jwt expired')) {
      console.log('🔄 API: JWT scaduto, tentativo refresh...');
      const refreshed = await tryRefreshToken();
      
      if (refreshed) {
        // Ricostruisci gli headers con il nuovo token
        const newHeaders = { ...buildHeaders(true) };
        if (options.headers) {
          Object.assign(newHeaders, options.headers);
        }
        newHeaders['Authorization'] = `Bearer ${localStorage.getItem('auth_token')}`;
        
        // Riprova la chiamata
        response = await fetch(url, { ...options, headers: newHeaders });
        console.log('🔄 API: Chiamata riprovata dopo refresh');
      } else {
        // Refresh fallito, forza logout
        console.log('❌ API: Refresh fallito, richiesto nuovo login');
        // Dispatch un evento per notificare l'app
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
      }
    }
  }
  
  return response;
};

const buildHeaders = (authRequired: boolean = false) => {
  const userToken = (typeof window !== 'undefined') ? localStorage.getItem('auth_token') : null;
  const bearer = authRequired && userToken ? userToken : API_CONFIG.SUPABASE_ANON_KEY;
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'apikey': API_CONFIG.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${bearer}`,
  } as Record<string, string>;
};

export const apiService = {
  // Client search
  async searchClients(query: string): Promise<Client[]> {
    if (!isSupabaseConfigured()) return [];
    
    try {
      const url = `${API_ENDPOINTS.SEARCH_CLIENTS}?select=id,first_name,last_name,phone_e164&or=(first_name.ilike.*${query}*,last_name.ilike.*${query}*,phone_e164.ilike.*${query}*)&limit=10`;
      const response = await fetch(url, { headers: buildHeaders() });
      if (!response.ok) throw new Error('Failed to search clients');
      return await response.json();
    } catch (error) {
      console.error('Error searching clients:', error);
      return [];
    }
  },

  // Update or create client by email (pubblico - non richiede autenticazione)
  async updateClientByEmail(email: string, data: { first_name?: string; last_name?: string | null; phone_e164?: string }): Promise<void> {
    if (!isSupabaseConfigured()) {
      // Se Supabase non è configurato, non fare nulla (silent fail)
      return;
    }
    
    try {
      // Prima cerca se il cliente esiste (usa accesso pubblico)
      const searchUrl = `${API_ENDPOINTS.SEARCH_CLIENTS}?select=id&email=eq.${encodeURIComponent(email)}&limit=1`;
      const searchResponse = await fetch(searchUrl, { headers: buildHeaders(false) });
      
      if (searchResponse.ok) {
        const clients = await searchResponse.json();
        
        if (clients && clients.length > 0) {
          // Cliente esiste - aggiorna (usa accesso pubblico)
          const clientId = clients[0].id;
          const updateResponse = await fetch(`${API_ENDPOINTS.SEARCH_CLIENTS}?id=eq.${clientId}`, {
            method: 'PATCH',
            headers: { ...buildHeaders(false), Prefer: 'return=minimal' },
            body: JSON.stringify(data),
          });
          
          if (updateResponse.ok) {
            console.log('✅ Record client aggiornato nel database, ID:', clientId);
          } else {
            // Se fallisce, non loggare come errore - potrebbe essere un problema di RLS
            // Non bloccare il flusso
          }
        } else {
          // Cliente non esiste - crealo (usa accesso pubblico)
          const shop = await this.getShop();
          const createData = {
            shop_id: shop?.id && shop.id !== 'default' ? shop.id : null,
            first_name: data.first_name || 'Cliente',
            last_name: data.last_name || null,
            phone_e164: data.phone_e164 || '+39000000000',
            email: email,
          };
          
          const createResponse = await fetch(API_ENDPOINTS.SEARCH_CLIENTS, {
            method: 'POST',
            headers: { ...buildHeaders(false), Prefer: 'return=representation' },
            body: JSON.stringify(createData),
          });
          
          if (createResponse.ok) {
            console.log('✅ Nuovo client creato nel database per email:', email);
          } else {
            // Se fallisce, non loggare come errore - potrebbe essere un problema di RLS
            // Non bloccare il flusso
          }
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

  // Get or create client from authenticated user (pubblico - non richiede autenticazione)
  async getOrCreateClientFromUser(user: { id: string; email?: string; full_name?: string; phone?: string }): Promise<{ id: string; email?: string | null; phone_e164?: string | null }> {
    if (!isSupabaseConfigured()) {
      // Se Supabase non è configurato, genera un ID temporaneo
      return { id: `temp_client_${Date.now()}`, email: user.email ?? null, phone_e164: user.phone ?? null };
    }
    
    try {
      // Cerca se esiste già un cliente con questa email (usa accesso pubblico)
      if (user.email) {
        const searchUrl = `${API_ENDPOINTS.SEARCH_CLIENTS}?select=id,email,phone_e164&email=eq.${encodeURIComponent(user.email)}&limit=1`;
        const searchResponse = await fetch(searchUrl, { headers: buildHeaders(false) });
        
        if (searchResponse.ok) {
          const existingClients = await searchResponse.json();
          if (existingClients && existingClients.length > 0) {
            const existingClient = existingClients[0];
            
            // Aggiorna il numero se manca e l'utente lo ha fornito
            if ((!existingClient.phone_e164 || existingClient.phone_e164 === '+39000000000') && user.phone) {
              try {
                await fetch(`${API_ENDPOINTS.SEARCH_CLIENTS}?id=eq.${existingClient.id}`, {
                  method: 'PATCH',
                  headers: { ...buildHeaders(false), Prefer: 'return=representation' },
                  body: JSON.stringify({ phone_e164: user.phone }),
                });
                existingClient.phone_e164 = user.phone;
                console.log('☎️ Numero cliente aggiornato per:', existingClient.id);
              } catch (updateError) {
                console.warn('⚠️ Impossibile aggiornare il numero del cliente:', updateError);
              }
            }
            
            console.log('✅ Cliente esistente trovato:', existingClient.id);
            return existingClient;
          }
        }
      }

      // Se non esiste, crea un nuovo cliente (usa accesso pubblico)
      const shop = await this.getShop();
      const fullName = user.full_name || 'Cliente';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || 'Cliente';
      const lastName = nameParts.slice(1).join(' ') || null;
      
      const clientData: Partial<Client> = {
        shop_id: shop?.id && shop.id !== 'default' ? shop.id : null,
        first_name: firstName,
        last_name: lastName,
        phone_e164: user.phone || '+39000000000',
        email: user.email || null,
      };

      const createResponse = await fetch(API_ENDPOINTS.SEARCH_CLIENTS, {
        method: 'POST',
        headers: { ...buildHeaders(false), Prefer: 'return=representation' },
        body: JSON.stringify(clientData),
      });

      if (createResponse.ok) {
        const created = await createResponse.json();
        const client = created[0];
        console.log('✅ Nuovo cliente creato:', client?.id);
        return client;
      } else {
        // Se la creazione fallisce, genera un ID temporaneo invece di lanciare errore
        const tempId = `temp_client_${Date.now()}`;
        console.warn('⚠️ Impossibile creare cliente nel DB, uso ID temporaneo:', tempId);
        return { id: tempId, email: user.email ?? null, phone_e164: user.phone ?? null };
      }
    } catch (error) {
      // Se c'è un errore, genera un ID temporaneo invece di lanciare errore
      const tempId = `temp_client_${Date.now()}`;
      console.warn('⚠️ Errore creazione cliente, uso ID temporaneo:', tempId);
      return { id: tempId, email: user.email ?? null, phone_e164: user.phone ?? null };
    }
  },

  async getDailyShopHours(): Promise<ShopHoursConfig> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase non configurato - uso configurazione orari di default');
      return createDefaultShopHoursConfig();
    }

    try {
      const shop = await this.getShop();
      if (!shop?.id) {
        return createDefaultShopHoursConfig();
      }

      // Usa buildHeaders(false) per permettere lettura pubblica degli orari
      const url = `${API_ENDPOINTS.SHOP_DAILY_HOURS}?select=*,shop_daily_time_slots(*)&shop_id=eq.${shop.id}&order=day_of_week.asc`;
      const response = await fetch(url, { headers: buildHeaders(false) });
      if (!response.ok) {
        throw new Error(`Failed to fetch shop daily hours: ${response.status}`);
      }

      const rows = await response.json() as ShopDailyHoursEntity[];
      const config = createDefaultShopHoursConfig();

      rows.forEach((row) => {
        if (row.day_of_week < 0 || row.day_of_week > 6) return;
        const timeSlots = (row.shop_daily_time_slots ?? [])
          .sort((a, b) => {
            const positionDiff = (a.position ?? 0) - (b.position ?? 0);
            if (positionDiff !== 0) return positionDiff;
            return (a.start_time ?? '').localeCompare(b.start_time ?? '');
          })
          .map((slot: ShopDailyTimeSlotRow): TimeSlot => ({
            start: formatTimeToHHMM(slot.start_time ?? ''),
            end: formatTimeToHHMM(slot.end_time ?? ''),
          }))
          .filter((slot) => Boolean(slot.start && slot.end));

        config[row.day_of_week] = {
          isOpen: row.is_open,
          timeSlots,
        };
      });

      return config;
    } catch (error) {
      console.error('Error loading daily shop hours:', error);
      return createDefaultShopHoursConfig();
    }
  },

  async saveDailyShopHours(hoursConfig: ShopHoursConfig): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase non configurato - impossibile salvare gli orari del negozio');
      return;
    }

    try {
      const shop = await this.getShop();
      if (!shop?.id) {
        throw new Error('Impossibile determinare l\'ID del negozio');
      }

      const headers = buildHeaders(true);

      const existingRes = await fetch(
        `${API_ENDPOINTS.SHOP_DAILY_HOURS}?select=*,shop_daily_time_slots(*)&shop_id=eq.${shop.id}`,
        { headers }
      );
      if (!existingRes.ok) {
        throw new Error(`Failed to load existing shop hours: ${existingRes.status}`);
      }
      const existingRows = await existingRes.json() as ShopDailyHoursEntity[];
      const existingMap = new Map<number, ShopDailyHoursEntity>();
      existingRows.forEach((row) => existingMap.set(row.day_of_week, row));

      for (let day = 0; day < 7; day += 1) {
        const dayConfig = hoursConfig[day] ?? { isOpen: false, timeSlots: [] };
        let currentRow = existingMap.get(day);

        if (currentRow) {
          const updateRes = await fetch(`${API_ENDPOINTS.SHOP_DAILY_HOURS}?id=eq.${currentRow.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ is_open: dayConfig.isOpen }),
          });
          if (!updateRes.ok) {
            const errorText = await updateRes.text();
            throw new Error(`Failed to update shop hours (${day}): ${errorText}`);
          }
        } else {
          const createRes = await fetch(API_ENDPOINTS.SHOP_DAILY_HOURS, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=representation' },
            body: JSON.stringify([{
              shop_id: shop.id,
              day_of_week: day,
              is_open: dayConfig.isOpen,
            }]),
          });
          if (!createRes.ok) {
            const errorText = await createRes.text();
            throw new Error(`Failed to create daily hours (${day}): ${errorText}`);
          }
          const created = await createRes.json() as ShopDailyHoursEntity[];
          currentRow = created[0];
          existingMap.set(day, currentRow);
        }

        if (!currentRow) continue;

        const deleteSlotsRes = await fetch(`${API_ENDPOINTS.SHOP_DAILY_TIME_SLOTS}?daily_hours_id=eq.${currentRow.id}`, {
          method: 'DELETE',
          headers,
        });
        if (!deleteSlotsRes.ok) {
          const errorText = await deleteSlotsRes.text();
          throw new Error(`Failed to clear time slots (${day}): ${errorText}`);
        }

        if (dayConfig.isOpen && dayConfig.timeSlots.length > 0) {
          const payload = dayConfig.timeSlots.map((slot, index) => ({
            daily_hours_id: currentRow!.id,
            start_time: normalizeTimeString(slot.start),
            end_time: normalizeTimeString(slot.end),
            position: index,
          }));

          const insertSlotsRes = await fetch(API_ENDPOINTS.SHOP_DAILY_TIME_SLOTS, {
            method: 'POST',
            headers: { ...headers, Prefer: 'return=minimal' },
            body: JSON.stringify(payload),
          });
          if (!insertSlotsRes.ok) {
            const errorText = await insertSlotsRes.text();
            throw new Error(`Failed to insert time slots (${day}): ${errorText}`);
          }
        }
      }
    } catch (error) {
      console.error('Error saving daily shop hours:', error);
      throw error;
    }
  },

  // Get appointments
  async getAppointments(start: string, end: string): Promise<Appointment[]> {
    if (!isSupabaseConfigured()) return [];
    
    try {
      // Usa buildHeaders(false) per permettere lettura pubblica degli appuntamenti
      // Questo permette sia ai clienti che ai barbieri di vedere gli appuntamenti
      // Include services per mostrare nome servizio e durata
      const url = `${API_ENDPOINTS.APPOINTMENTS_FEED}?select=*,clients(first_name,last_name,phone_e164,email),staff(full_name),services(id,name,duration_min)&order=start_at.asc&start_at=gte.${start}&start_at=lte.${end}`;
      const response = await fetch(url, { headers: buildHeaders(false) });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error fetching appointments:', response.status, errorText);
        throw new Error(`Failed to fetch appointments: ${response.status}`);
      }
      const data = await response.json();
      console.log('📅 Appuntamenti caricati dal database:', data.length);
      return data;
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
  },

  // Create appointment via n8n webhook (legacy)
  async createAppointment(data: CreateAppointmentRequest): Promise<void> {
    if (!isSupabaseConfigured() || !API_CONFIG.N8N_BASE_URL) throw new Error('Backend non configurato');
    
    try {
      const response = await fetch(API_ENDPOINTS.CREATE_APPOINTMENT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create appointment');
    } catch (error) {
      console.error('Error creating appointment:', error);
      throw error;
    }
  },

  // Create appointment directly in Supabase (for client bookings)
  async createAppointmentDirect(data: {
    client_id: string;
    staff_id: string;
    service_id: string;
    start_at: string;
    end_at: string;
    notes?: string;
    status?: string;
  }): Promise<any> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    
    try {
      // Get shop_id from shop
      const shop = await this.getShop();
      
      const payload = {
        shop_id: shop?.id && shop.id !== 'default' ? shop.id : null,
        client_id: data.client_id,
        staff_id: data.staff_id,
        service_id: data.service_id,
        start_at: data.start_at,
        end_at: data.end_at,
        notes: data.notes || '',
        status: data.status || 'confirmed',
      };
      
      console.log('📝 Tentativo creazione appuntamento con payload:', payload);
      console.log('📝 Endpoint:', API_ENDPOINTS.APPOINTMENTS_FEED);
      
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
      console.log('✅ Appuntamento creato nel database:', created[0]);
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
      console.warn('Backend non configurato - modalità ferie attivata senza cancellazione appuntamenti');
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

  // Get staff profile
  async getStaffProfile(): Promise<Staff> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    
    try {
      const url = `${API_ENDPOINTS.STAFF}?select=*&limit=1`;
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
        headers: { ...buildHeaders(false), Prefer: 'resolution=merge-duplicates,return=minimal' },
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
      const response = await fetch(API_ENDPOINTS.SERVICES, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create service');
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

  // Get shop (pubblico - non richiede autenticazione)
  async getShop(): Promise<Shop> {
    if (!isSupabaseConfigured()) {
      // Restituisci shop di default se Supabase non è configurato
      return {
        id: 'default',
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    
    try {
      // Usa buildHeaders(false) per permettere accesso pubblico
      const url = `${API_ENDPOINTS.SHOPS}?select=*&limit=1`;
      const response = await fetch(url, { headers: buildHeaders(false) });
      if (!response.ok) {
        // Se fallisce, restituisci shop di default invece di lanciare errore
        return {
          id: 'default',
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      const shops = await response.json();
      
      if (!shops || shops.length === 0) {
        // Se non ci sono shop, crea uno di default
        const defaultShop: Shop = {
          id: 'default',
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return defaultShop;
      }
      
      return shops[0];
    } catch (error) {
      // Non loggare errori per getShop - è normale se non autenticato
      // Restituisci shop di default
      return {
        id: 'default',
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
  },

  // Update shop
  async updateShop(data: Shop): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    
    try {
      if (data.id === 'default') {
        // Se è un shop di default, crea un nuovo record
        const { id, ...shopData } = data;
        const response = await fetch(API_ENDPOINTS.SHOPS, {
          method: 'POST',
          headers: { ...buildHeaders(true), Prefer: 'return=representation' },
          body: JSON.stringify(shopData),
        });
        if (!response.ok) throw new Error('Failed to create shop');
      } else {
        // Aggiorna shop esistente
        const response = await fetch(`${API_ENDPOINTS.SHOPS}?id=eq.${data.id}`, {
          method: 'PATCH',
          headers: { ...buildHeaders(true) },
          body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error('Failed to update shop');
      }
    } catch (error) {
      console.error('Error updating shop:', error);
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
      const url = `${API_ENDPOINTS.CHATS}?select=*&order=updated_at.desc`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) {
        // Se è un errore di autenticazione, non loggare
        if (response.status === 401) {
          return [];
        }
        throw new Error('Failed to fetch chats');
      }
      return await response.json();
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
      const url = `${API_ENDPOINTS.CHAT_MESSAGES}?select=*&chat_id=eq.${chatId}&order=created_at.asc`;
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
      if (!response.ok) throw new Error('Failed to send message');
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
      const url = `${API_ENDPOINTS.CHATS}?select=*&client_id=eq.${clientId}&staff_id=eq.${staffId}&limit=1`;
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
      // Mostra tutti i servizi (attivi e non), ordinati per nome
      // Usa buildHeaders(false) per permettere lettura pubblica (clienti inclusi)
      const url = `${API_ENDPOINTS.SERVICES}?select=*&order=name.asc`;
      const response = await fetch(url, { headers: buildHeaders(false) });
      if (!response.ok) throw new Error('Failed to fetch services');
      return await response.json();
    } catch (error) {
      console.error('Error fetching services:', error);
      return [];
    }
  },

  // Get all staff (pubblico per permettere ai clienti di vedere i barbieri disponibili)
  async getStaff(): Promise<Staff[]> {
    if (!isSupabaseConfigured()) return [];
    
    try {
      // Usa buildHeaders(false) per permettere accesso pubblico (clienti possono vedere i barbieri)
      const url = `${API_ENDPOINTS.STAFF}?select=*&order=full_name.asc`;
      const response = await fetch(url, { headers: buildHeaders(false) });
      if (!response.ok) {
        // Se fallisce, restituisci array vuoto invece di loggare errore
        return [];
      }
      return await response.json();
    } catch (error) {
      // Non loggare errori per getStaff quando non autenticato - è normale
      return [];
    }
  },

  // Create new staff member
  async createStaff(staffData: Omit<Staff, 'id' | 'created_at'>): Promise<Staff> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    
    try {
      // Ottieni lo shop_id reale dal database
      let shopId = staffData.shop_id;
      if (!shopId || shopId === '1') {
        try {
          const shop = await this.getShop();
          shopId = shop?.id || null;
        } catch {
          shopId = null; // Se non riesce a ottenere lo shop, lascia null
        }
      }
      
      // Invia solo i campi che esistono nella tabella staff del DB
      const payload: Record<string, any> = {
        full_name: staffData.full_name,
        role: staffData.role,
        active: staffData.active ?? true,
      };
      
      // Aggiungi shop_id solo se è un UUID valido
      if (shopId && shopId !== '1') {
        payload.shop_id = shopId;
      }
      
      // Aggiungi campi opzionali solo se hanno un valore
      if (staffData.calendar_id) payload.calendar_id = staffData.calendar_id;
      if (staffData.email) payload.email = staffData.email;
      if (staffData.phone) payload.phone = staffData.phone;
      if ((staffData as any).chair_id) payload.chair_id = (staffData as any).chair_id;
      
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
      return created[0] as Staff;
    } catch (error) {
      console.error('Error creating staff:', error);
      throw error;
    }
  },

  // Update existing staff member
  async updateStaff(id: string, staffData: Partial<Staff>): Promise<Staff> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    
    try {
      // Filtra solo i campi che esistono nel DB (incluso chair_id per assegnazione poltrone)
      const dbFields = ['shop_id', 'full_name', 'role', 'calendar_id', 'active', 'email', 'phone', 'chair_id', 'profile_photo_url', 'specialties', 'bio'];
      const payload: Record<string, any> = {};
      
      for (const key of dbFields) {
        if (key in staffData) {
          payload[key] = (staffData as any)[key];
        }
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
      return { ...updated[0], ...staffData } as Staff;
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
      const url = `${API_ENDPOINTS.PRODUCTS}?select=*&order=name.asc`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) throw new Error('Failed to fetch products');
      return await response.json();
    } catch (error) {
      console.error('Error fetching products:', error);
      return [];
    }
  },

  // Create product
  async createProduct(productData: Partial<Product>): Promise<Product> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    
    try {
      const payload = {
        ...productData,
        active: true,
      } as any;
      console.log('DEBUG createProduct payload', payload);
      const response = await fetch(API_ENDPOINTS.PRODUCTS, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let detail = '';
        try { detail = await response.text(); } catch {}
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
      console.log('DEBUG updateProduct payload', id, payload);
      const response = await fetch(`${API_ENDPOINTS.PRODUCTS}?id=eq.${id}`, {
        method: 'PATCH',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let detail = '';
        try { detail = await response.text(); } catch {}
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
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATIONS}?id=eq.${notificationId}`, {
        method: 'DELETE',
        headers: buildHeaders(true),
      });
      if (!response.ok) throw new Error('Failed to delete notification');
    } catch (error) {
      console.error('Error deleting notification:', error);
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
      
      console.log('✅ Appuntamento cancellato:', appointmentId);
    } catch (error) {
      console.error('❌ Errore critico cancellazione appuntamento:', error);
      throw error;
    }
  },

  // Create a notification for a user
  async createNotification(data: {
    user_id: string;
    user_type: 'staff' | 'client';
    type: 'new_appointment' | 'appointment_cancelled' | 'appointment_reminder' | 'system' | 'new_client';
    title: string;
    message: string;
    data?: Record<string, unknown>;
  }): Promise<Notification | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase non configurato - notifica non creata');
      return null;
    }
    
    try {
      const shop = await this.getShop();
      
      const payload = {
        shop_id: shop?.id && shop.id !== 'default' ? shop.id : null,
        user_id: data.user_id,
        user_type: data.user_type,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {},
      };
      
      console.log('📤 Tentativo creazione notifica:', payload);
      console.log('📤 Endpoint:', API_ENDPOINTS.NOTIFICATIONS);
      
      const response = await fetch(API_ENDPOINTS.NOTIFICATIONS, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      
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
      console.log('✅ Notifica creata con successo:', created[0]);
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
      const response = await fetch(url, { headers: buildHeaders(false) });
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
      const url = `${API_ENDPOINTS.APPOINTMENTS_FEED}?id=eq.${appointmentId}&select=*,clients(first_name,last_name,phone_e164,email),staff(id,full_name,email),services(id,name,duration_min)&limit=1`;
      const response = await fetch(url, { headers: buildHeaders(false) });
      if (!response.ok) return null;
      const appointments = await response.json();
      return appointments[0] || null;
    } catch (error) {
      console.error('Error fetching appointment by id:', error);
      return null;
    }
  },

  // ============================================
  // Waitlist - Lista d'attesa
  // ============================================

  // Join waitlist - Mettersi in coda per i prossimi giorni
  async joinWaitlist(data: JoinWaitlistRequest): Promise<WaitlistEntry | null> {
    if (!isSupabaseConfigured()) {
      console.warn('Supabase non configurato - impossibile mettersi in coda');
      return null;
    }
    
    try {
      const shop = await this.getShop();
      
      // Calcola la data di scadenza (fine dell'ultima data preferita)
      const sortedDates = [...data.preferred_dates].sort();
      const lastDate = sortedDates[sortedDates.length - 1];
      const expiresAt = new Date(lastDate);
      expiresAt.setHours(23, 59, 59, 999);
      
      const payload = {
        shop_id: shop?.id && shop.id !== 'default' ? shop.id : null,
        client_id: data.client_id,
        service_id: data.service_id || null,
        staff_id: data.staff_id || null,
        preferred_dates: data.preferred_dates,
        status: 'waiting',
        expires_at: expiresAt.toISOString(),
        notes: data.notes || null,
      };
      
      console.log('📝 Tentativo inserimento in waitlist:', payload);
      
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
      console.log('✅ Aggiunto alla lista d\'attesa:', created[0]);
      return created[0];
    } catch (error) {
      console.error('❌ Errore critico inserimento in waitlist:', error);
      throw error;
    }
  },

  // Leave waitlist - Rimuoversi dalla coda
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
      
      console.log('✅ Rimosso dalla lista d\'attesa:', waitlistId);
    } catch (error) {
      console.error('❌ Errore rimozione da waitlist:', error);
      throw error;
    }
  },

  // Get client's waitlist status - Vedere il proprio stato in coda
  async getClientWaitlistStatus(clientId: string): Promise<WaitlistEntry[]> {
    if (!isSupabaseConfigured()) return [];
    
    try {
      // Ottieni solo le entry attive (waiting o notified) che non sono scadute
      const url = `${API_ENDPOINTS.WAITLIST}?client_id=eq.${clientId}&status=in.(waiting,notified)&expires_at=gte.${new Date().toISOString()}&select=*,services(id,name),staff(id,full_name)&order=created_at.desc`;
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
  async updateWaitlistStatus(waitlistId: string, status: 'waiting' | 'notified' | 'booked' | 'expired'): Promise<void> {
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
      
      console.log('✅ Stato waitlist aggiornato:', waitlistId, status);
    } catch (error) {
      console.error('❌ Errore aggiornamento stato waitlist:', error);
      throw error;
    }
  },

  // Check if client is already in waitlist for specific dates
  async isClientInWaitlist(clientId: string, dates: string[]): Promise<boolean> {
    if (!isSupabaseConfigured()) return false;
    
    try {
      // Cerca entry attive per questo cliente
      const waitlistEntries = await this.getClientWaitlistStatus(clientId);
      
      // Controlla se una qualsiasi delle date richieste è già in coda
      for (const entry of waitlistEntries) {
        const entryDates = entry.preferred_dates || [];
        for (const date of dates) {
          if (entryDates.includes(date)) {
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error checking waitlist:', error);
      return false;
    }
  },
};