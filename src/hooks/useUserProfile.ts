import { useState } from 'react';
import type { User } from '../types/auth';
import { apiService } from '../services/api';

export interface UserProfileData {
  full_name: string;
  phone?: string;
  email: string;
  address?: string;
  notes?: string;
  profile_photo_url?: string;
  profile_photo_path?: string;
}

export const useUserProfile = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Carica il profilo utente dal localStorage
  const loadUserProfile = (userId: string): UserProfileData | null => {
    try {
      const savedProfile = localStorage.getItem(`user_profile_${userId}`);
      if (savedProfile) {
        return JSON.parse(savedProfile);
      }
    } catch (error) {
      console.error('Errore nel caricamento del profilo utente:', error);
    }
    return null;
  };

  // Salva il profilo utente nel localStorage
  const saveUserProfile = (userId: string, profileData: UserProfileData): boolean => {
    try {
      localStorage.setItem(`user_profile_${userId}`, JSON.stringify(profileData));
      return true;
    } catch (error) {
      console.error('Errore nel salvataggio del profilo utente:', error);
      return false;
    }
  };

  // Normalizza il telefono in formato E.164
  const normalizePhone = (phone: string): string => {
    if (!phone) return '+39000000000';
    let cleaned = phone.replace(/\s/g, '').replace(/[^0-9+]/g, '');
    if (cleaned.startsWith('0039')) cleaned = cleaned.substring(4);
    else if (cleaned.startsWith('+39')) cleaned = cleaned.substring(3);
    else if (cleaned.startsWith('39') && cleaned.length > 10) cleaned = cleaned.substring(2);
    return `+39${cleaned}`;
  };

  // Aggiorna il profilo utente
  const updateUserProfile = async (userId: string, profileData: UserProfileData): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Salva nel localStorage
      const success = saveUserProfile(userId, profileData);
      
      if (success) {
        console.log('✅ Profilo utente aggiornato con successo:', profileData);
        
        // Aggiorna anche i dati dell'utente nel localStorage
        const currentUser = localStorage.getItem('auth_user');
        if (currentUser) {
          const user: User = JSON.parse(currentUser);
          const updatedUser = {
            ...user,
            full_name: profileData.full_name,
            email: profileData.email,
            phone: profileData.phone,
            profile_photo_url: profileData.profile_photo_url,
            profile_photo_path: profileData.profile_photo_path,
          };
          localStorage.setItem('auth_user', JSON.stringify(updatedUser));
        }
        
        // Aggiorna anche il record client nel database
        try {
          await apiService.updateClientByEmail(profileData.email, {
            first_name: profileData.full_name.split(' ')[0] || 'Cliente',
            last_name: profileData.full_name.split(' ').slice(1).join(' ') || null,
            phone_e164: normalizePhone(profileData.phone || ''),
          });
          console.log('✅ Record client aggiornato nel database');
        } catch (dbError) {
          console.warn('⚠️ Errore aggiornamento client nel DB:', dbError);
          // Non bloccare se il DB fallisce
        }
      }
      
      return success;
    } catch (error) {
      console.error('❌ Errore nell\'aggiornamento del profilo utente:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Ottieni il profilo utente con fallback ai dati di base
  const getUserProfile = (user: User | null): UserProfileData => {
    if (!user) {
      return {
        full_name: '',
        email: '',
        phone: '',
        address: '',
        notes: '',
        profile_photo_url: '',
        profile_photo_path: '',
      };
    }

    // Prova a caricare il profilo salvato
    const savedProfile = loadUserProfile(user.id);
    
    if (savedProfile) {
      return savedProfile;
    }

    // Fallback ai dati di base dell'utente
    return {
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: '',
      notes: '',
      profile_photo_url: (user as any).profile_photo_url || '',
      profile_photo_path: (user as any).profile_photo_path || '',
    };
  };

  // Elimina il profilo utente
  const deleteUserProfile = (userId: string): boolean => {
    try {
      localStorage.removeItem(`user_profile_${userId}`);
      console.log('✅ Profilo utente eliminato:', userId);
      return true;
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione del profilo utente:', error);
      return false;
    }
  };

  return {
    isLoading,
    loadUserProfile,
    saveUserProfile,
    updateUserProfile,
    getUserProfile,
    deleteUserProfile,
  };
};
