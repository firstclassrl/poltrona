export interface Database {
  public: {
    Tables: {
      shops: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
      };
      profiles: {
        Row: {
          user_id: string;
          shop_id: string | null;
          role: string | null;
          full_name: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          shop_id?: string | null;
          role?: string | null;
          full_name?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          shop_id?: string | null;
          role?: string | null;
          full_name?: string | null;
          created_at?: string;
        };
      };
      staff: {
        Row: {
          id: string;
          shop_id: string | null;
          full_name: string;
          role: string | null;
          calendar_id: string | null;
          active: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          full_name: string;
          role?: string | null;
          calendar_id?: string | null;
          active?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          full_name?: string;
          role?: string | null;
          calendar_id?: string | null;
          active?: boolean | null;
          created_at?: string;
        };
      };
      services: {
        Row: {
          id: string;
          shop_id: string | null;
          name: string;
          duration_min: number;
          price_cents: number | null;
          active: boolean | null;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          name: string;
          duration_min: number;
          price_cents?: number | null;
          active?: boolean | null;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          name?: string;
          duration_min?: number;
          price_cents?: number | null;
          active?: boolean | null;
        };
      };
      clients: {
        Row: {
          id: string;
          shop_id: string | null;
          first_name: string;
          last_name: string | null;
          phone_e164: string;
          email: string | null;
          photo_url: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          first_name: string;
          last_name?: string | null;
          phone_e164: string;
          email?: string | null;
          photo_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          first_name?: string;
          last_name?: string | null;
          phone_e164?: string;
          email?: string | null;
          photo_url?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      appointments: {
        Row: {
          id: string;
          shop_id: string | null;
          client_id: string | null;
          client_name?: string | null;
          staff_id: string | null;
          service_id: string | null;
          start_at: string;
          end_at: string;
          status: string | null;
          notes: string | null;
          gcal_event_id: string | null;
          reminder_sent?: boolean | null;
          reminder_sent_at?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id?: string | null;
          client_id?: string | null;
          client_name?: string | null;
          staff_id?: string | null;
          service_id?: string | null;
          start_at: string;
          end_at: string;
          status?: string | null;
          notes?: string | null;
          gcal_event_id?: string | null;
          reminder_sent?: boolean | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string | null;
          client_id?: string | null;
          client_name?: string | null;
          staff_id?: string | null;
          service_id?: string | null;
          start_at?: string;
          end_at?: string;
          status?: string | null;
          notes?: string | null;
          gcal_event_id?: string | null;
          reminder_sent?: boolean | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}