export const API_CONFIG = {
  N8N_BASE_URL: import.meta.env.VITE_N8N_BASE_URL || '',
  // Usa VITE_SUPABASE_EDGE_URL; se non presente, fallback a VITE_SUPABASE_URL
  SUPABASE_EDGE_URL: (import.meta.env.VITE_SUPABASE_EDGE_URL || import.meta.env.VITE_SUPABASE_URL || '').trim(),
  SUPABASE_ANON_KEY: (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim(),
  // Configurazione Resend per email
  RESEND_API_KEY: (import.meta.env.VITE_RESEND_API_KEY || '').trim(),
};

export const API_ENDPOINTS = {
  CREATE_APPOINTMENT: `${API_CONFIG.N8N_BASE_URL}/webhook/appt/create`,
  UPDATE_APPOINTMENT: `${API_CONFIG.N8N_BASE_URL}/webhook/appt/update`,
  CANCEL_APPOINTMENT: `${API_CONFIG.N8N_BASE_URL}/webhook/appt/cancel`,
  SEARCH_CLIENTS: `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/clients`,
  APPOINTMENTS_FEED: `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/appointments`,
  PROFILES: `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/profiles`,
  STAFF: `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/staff`,
  SERVICES: `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/services`,
  PRODUCTS: `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/products`,
  SHOPS: `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/shops`,
  CHATS: `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/chats`,
  CHAT_MESSAGES: `${API_CONFIG.SUPABASE_EDGE_URL}/rest/v1/chat_messages`,
};