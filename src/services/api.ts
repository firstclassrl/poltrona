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
  CreateMessageRequest
} from '../types';

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

  // Get appointments
  async getAppointments(start: string, end: string): Promise<Appointment[]> {
    if (!isSupabaseConfigured()) return [];
    
    try {
      const url = `${API_ENDPOINTS.APPOINTMENTS_FEED}?select=*,clients(first_name,last_name,phone_e164),staff(full_name)&order=start_at.asc&start_at=gte.${start}&start_at=lte.${end}`;
      const response = await fetch(url, { headers: buildHeaders() });
      if (!response.ok) throw new Error('Failed to fetch appointments');
      return await response.json();
    } catch (error) {
      console.error('Error fetching appointments:', error);
      return [];
    }
  },

  // Create appointment
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
    if (!isSupabaseConfigured() || !API_CONFIG.N8N_BASE_URL) throw new Error('Backend non configurato');
    
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
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) throw new Error('Failed to fetch staff profile');
      const staff = await response.json();
      return staff[0];
    } catch (error) {
      console.error('Error fetching staff profile:', error);
      throw error;
    }
  },

  // Update staff profile
  async updateStaffProfile(data: Staff): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    
    try {
      const response = await fetch(`${API_ENDPOINTS.STAFF}?id=eq.${data.id}`, {
        method: 'PATCH',
        headers: { ...buildHeaders(true) },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update staff profile');
    } catch (error) {
      console.error('Error updating staff profile:', error);
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

  // Update shop hours
  async updateShopHours(hoursData: {
    morningOpening: string;
    morningClosing: string;
    afternoonOpening: string;
    afternoonClosing: string;
    closedDays: number[];
  }): Promise<void> {
    if (!isSupabaseConfigured()) throw new Error('Supabase non configurato');
    
    try {
      // Get current shop data
      const shop = await this.getShop();
      
      // Update shop with hours data
      const updatedShop = {
        ...shop,
        opening_hours: `${hoursData.morningOpening}-${hoursData.morningClosing} / ${hoursData.afternoonOpening}-${hoursData.afternoonClosing}`,
        updated_at: new Date().toISOString()
      };
      
      await this.updateShop(updatedShop);
    } catch (error) {
      console.error('Error updating shop hours:', error);
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
      const url = `${API_ENDPOINTS.SERVICES}?select=*&active=eq.true&order=name.asc`;
      const response = await fetch(url, { headers: buildHeaders(true) });
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
      const url = `${API_ENDPOINTS.STAFF}?select=*&active=eq.true&order=full_name.asc`;
      const response = await fetch(url, { headers: buildHeaders(true) });
      if (!response.ok) throw new Error('Failed to fetch staff');
      return await response.json();
    } catch (error) {
      console.error('Error fetching staff:', error);
      return [];
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
};