import { useState } from 'react';
import type { Staff } from '../types';

export interface BarberProfileData {
  full_name: string;
  role: string;
  phone?: string;
  email?: string;
  specialties?: string;
  bio?: string;
  chair_id?: string;
  profile_photo_url?: string;
}

export const useBarberProfile = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Carica il profilo barbiere dal localStorage
  const loadBarberProfile = (staffId: string): BarberProfileData | null => {
    try {
      const savedProfile = localStorage.getItem(`barber_profile_${staffId}`);
      if (savedProfile) {
        return JSON.parse(savedProfile);
      }
    } catch (error) {
      console.error('Errore nel caricamento del profilo barbiere:', error);
    }
    return null;
  };

  // Salva il profilo barbiere nel localStorage
  const saveBarberProfile = (staffId: string, profileData: BarberProfileData): boolean => {
    try {
      localStorage.setItem(`barber_profile_${staffId}`, JSON.stringify(profileData));
      return true;
    } catch (error) {
      console.error('Errore nel salvataggio del profilo barbiere:', error);
      return false;
    }
  };

  // Aggiorna il profilo barbiere
  const updateBarberProfile = async (staffId: string, profileData: BarberProfileData): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      // Simula chiamata API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Salva nel localStorage
      const success = saveBarberProfile(staffId, profileData);
      
      if (success) {
        console.log('✅ Profilo barbiere aggiornato con successo:', profileData);
        
        // Aggiorna anche i dati del barbiere nel localStorage generale
        const allStaff = localStorage.getItem('staff_data');
        if (allStaff) {
          const staffArray: Staff[] = JSON.parse(allStaff);
          const updatedStaffArray = staffArray.map(staff => 
            staff.id === staffId 
              ? { ...staff, ...profileData }
              : staff
          );
          localStorage.setItem('staff_data', JSON.stringify(updatedStaffArray));
        }
      }
      
      return success;
    } catch (error) {
      console.error('❌ Errore nell\'aggiornamento del profilo barbiere:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Ottieni il profilo barbiere con fallback ai dati di base
  const getBarberProfile = (staff: Staff | null): BarberProfileData => {
    if (!staff) {
      return {
        full_name: '',
        role: '',
        phone: '',
        email: '',
        specialties: '',
        bio: '',
        chair_id: '',
        profile_photo_url: ''
      };
    }

    // Prova a caricare il profilo salvato
    const savedProfile = loadBarberProfile(staff.id);
    
    if (savedProfile) {
      return savedProfile;
    }

    // Fallback ai dati di base del barbiere
    return {
      full_name: staff.full_name || '',
      role: staff.role || '',
      phone: '',
      email: staff.email || '',
      specialties: '',
      bio: '',
      chair_id: staff.chair_id || '',
      profile_photo_url: staff.profile_photo_url || ''
    };
  };

  // Elimina il profilo barbiere
  const deleteBarberProfile = (staffId: string): boolean => {
    try {
      localStorage.removeItem(`barber_profile_${staffId}`);
      console.log('✅ Profilo barbiere eliminato:', staffId);
      return true;
    } catch (error) {
      console.error('❌ Errore nell\'eliminazione del profilo barbiere:', error);
      return false;
    }
  };

  // Ottieni tutti i profili barbieri
  const getAllBarberProfiles = (): Record<string, BarberProfileData> => {
    try {
      const profiles: Record<string, BarberProfileData> = {};
      const allStaff = localStorage.getItem('staff_data');
      
      if (allStaff) {
        const staffArray: Staff[] = JSON.parse(allStaff);
        staffArray.forEach(staff => {
          const profile = loadBarberProfile(staff.id);
          if (profile) {
            profiles[staff.id] = profile;
          }
        });
      }
      
      return profiles;
    } catch (error) {
      console.error('❌ Errore nel caricamento di tutti i profili barbieri:', error);
      return {};
    }
  };

  return {
    isLoading,
    loadBarberProfile,
    saveBarberProfile,
    updateBarberProfile,
    getBarberProfile,
    deleteBarberProfile,
    getAllBarberProfiles,
  };
};
