export type UserRole = 'admin' | 'barber' | 'client';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  phone?: string;
}

export interface PrivacyConsent {
  accepted: boolean;
  acceptedAt: string; // ISO timestamp
  ipAddress?: string; // Opzionale per demo
  version: string; // Versione privacy policy
}

export interface ClientRegistrationData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  privacyConsent?: PrivacyConsent;
}

export interface RegisteredClient extends User {
  privacyConsent?: PrivacyConsent;
}



