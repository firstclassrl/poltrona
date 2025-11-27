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
  ShopHoursConfig,
  TimeSlot,
  ShopDailyHoursEntity,
  ShopDailyTimeSlotRow,
  Notification
} from '../types';
import { createDefaultShopHoursConfig, formatTimeToHHMM, normalizeTimeString } from '../utils/shopHours';

// Check if Supabase is configured
const isSupabaseConfigured = () => {
  return API_CONFIG.SUPABASE_EDGE_URL && API_CONFIG.SUPABASE_ANON_KEY;
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

      const url = `${API_ENDPOINTS.SHOP_DAILY_HOURS}?select=*,shop_daily_time_slots(*)&shop_id=eq.${shop.id}&order=day_of_week.asc`;
      const response = await fetch(url, { headers: buildHeaders(true) });
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
      const url = `${API_ENDPOINTS.APPOINTMENTS_FEED}?select=*,clients(first_name,last_name,phone_e164),staff(full_name)&order=start_at.asc&start_at=gte.${start}&start_at=lte.${end}`;
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
      
      const response = await fetch(API_ENDPOINTS.APPOINTMENTS_FEED, {
        method: 'POST',
        headers: { ...buildHeaders(true), Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      });
      
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

  // Get shop
  async getShop(): Promise<Shop> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    
    try {
      const url = `${API_ENDPOINTS.SHOPS}?select=*&limit=1`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) throw new Error('Failed to fetch shop');
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
      console.error('Error fetching shop:', error);
      throw error;
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

  // Chat functions
  async getChats(): Promise<Chat[]> {
    if (!isSupabaseConfigured()) return [];
    
    try {
      const url = `${API_ENDPOINTS.CHATS}?select=*&order=updated_at.desc`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) throw new Error('Failed to fetch chats');
      return await response.json();
    } catch (error) {
      console.error('Error fetching chats:', error);
      throw error;
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

  // Get all staff
  async getStaff(): Promise<Staff[]> {
    if (!isSupabaseConfigured()) return [];
    
    try {
      // Carica tutti i barbieri - usa token autenticato
      const url = `${API_ENDPOINTS.STAFF}?select=*&order=full_name.asc`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch staff: ${response.status} ${errorText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching staff:', error);
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

  // Get notifications for current user
  async getNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    if (!isSupabaseConfigured()) return [];
    
    try {
      const url = `${API_ENDPOINTS.NOTIFICATIONS}?user_id=eq.${userId}&order=created_at.desc&limit=${limit}`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return await response.json();
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  },

  // Get unread notifications count
  async getUnreadNotificationsCount(userId: string): Promise<number> {
    if (!isSupabaseConfigured()) return 0;
    
    try {
      const url = `${API_ENDPOINTS.NOTIFICATIONS}?user_id=eq.${userId}&read_at=is.null&select=id`;
      const response = await fetch(url, { 
        headers: { ...buildHeaders(true), 'Prefer': 'count=exact' } 
      });
      if (!response.ok) throw new Error('Failed to fetch notifications count');
      
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
      console.error('Error fetching unread count:', error);
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
};