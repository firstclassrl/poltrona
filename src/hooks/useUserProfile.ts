import { useState } from 'react';
import type { User } from '../types/auth';

export interface UserProfileData {
  full_name: string;
  phone?: string;
  email: string;
  address?: string;
  notes?: string;
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

  // Aggiorna il profilo utente
  const updateUserProfile = async (userId: string, profileData: UserProfileData): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Simula chiamata API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
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
            phone: profileData.phone
          };
          localStorage.setItem('auth_user', JSON.stringify(updatedUser));
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
        notes: ''
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
      notes: ''
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
