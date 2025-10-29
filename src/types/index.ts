export interface Client {
  id: string;
  shop_id: string | null;
  first_name: string;
  last_name: string | null;
  phone_e164: string;
  email?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface Staff {
  id: string;
  shop_id: string | null;
  full_name: string;
  role: string | null;
  calendar_id: string | null;
  active: boolean | null;
  chair_id?: string | null;
  profile_photo_url?: string | null;
  email?: string;
  phone?: string | null;
  specialties?: string | null;
  bio?: string | null;
  created_at: string;
}

export interface Service {
  id: string;
  shop_id: string | null;
  name: string;
  duration_min: number;
  price_cents: number | null;
  active: boolean | null;
  image_url?: string | null;
}

export interface Product {
  id: string;
  shop_id: string | null;
  name: string;
  description?: string | null;
  price_cents: number | null;
  image_url?: string | null;
  active: boolean | null;
  created_at: string;
  updated_at?: string;
}

export interface AppointmentProduct {
  productId: string;
  quantity: number;
  productName?: string;
  productPrice?: number;
}

export interface Appointment {
  id: string;
  shop_id: string | null;
  client_id: string | null;
  staff_id: string | null;
  service_id: string | null;
  start_at: string;
  end_at: string;
  status: 'scheduled' | 'confirmed' | 'rescheduled' | 'cancelled' | 'no_show' | 'completed' | null;
  notes: string | null;
  gcal_event_id: string | null;
  products?: AppointmentProduct[];
  created_at: string;
  updated_at: string;
  clients?: Client;
  staff?: Staff;
  services?: Service;
}

export interface Profile {
  user_id: string;
  shop_id: string | null;
  role: string | null;
  full_name: string | null;
  created_at: string;
}

export interface VacationPeriod {
  id?: string;
  start_date: string; // formato ISO
  end_date: string;   // formato ISO
  created_at?: string;
}

export interface Shop {
  id: string;
  name: string;
  address?: string;
  postal_code?: string;
  city?: string;
  province?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  notification_email?: string; // Email per ricevere notifiche per nuove registrazioni
  opening_hours?: string;
  opening_date?: string;
  description?: string;
  products_enabled?: boolean; // Controlla se il sistema prodotti è abilitato
  vacation_period?: VacationPeriod | null;
  created_at: string;
  updated_at?: string;
}

export interface Chair {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateAppointmentRequest {
  client_id: string;
  staff_id: string;
  service_id: string;
  start_at: string;
  end_at: string;
  notes?: string;
  status?: string;
}

export interface UpdateAppointmentRequest extends Partial<CreateAppointmentRequest> {
  id: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_type: 'client' | 'staff';
  content: string;
  message_type: 'text' | 'image' | 'file';
  created_at: string;
  read_at?: string;
  sender_name?: string;
  sender_photo?: string;
}

export interface Chat {
  id: string;
  client_id: string;
  staff_id: string;
  last_message?: ChatMessage;
  unread_count: number;
  created_at: string;
  updated_at: string;
  client_name: string;
  client_photo?: string;
  staff_name: string;
  staff_photo?: string;
}

export interface CreateMessageRequest {
  chat_id: string;
  content: string;
  message_type?: 'text' | 'image' | 'file';
}

// Daily shop hours configuration
export interface DailyHours {
  isOpen: boolean;
  timeSlots: TimeSlot[];
}

export interface TimeSlot {
  start: string; // Format: "HH:MM"
  end: string;   // Format: "HH:MM"
}

export interface ShopHoursConfig {
  [dayOfWeek: number]: DailyHours; // 0=Sunday, 1=Monday, ..., 6=Saturday
}