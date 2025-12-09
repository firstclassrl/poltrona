import { useState, useCallback } from 'react';
import type { Staff } from '../types';
import { apiService } from '../services/api';

export interface BarberProfileData {
  full_name: string;
  role: string;
  phone?: string;
  email?: string;
  specialties?: string;
  bio?: string;
  chair_id?: string;
  profile_photo_url?: string;
  profile_photo_path?: string;
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
      // Controlla se è un staff di default (non esistente nel database)
      const isDefaultStaff = staffId.startsWith('default-staff-');
      
      if (isDefaultStaff) {
        console.log('⚠️ Staff di default - salvataggio solo nel localStorage');
        
        // Per staff di default, salva solo nel localStorage
        const success = saveBarberProfile(staffId, profileData);
        
        if (success) {
          console.log('✅ Profilo barbiere di default salvato nel localStorage:', profileData);
          
          // Aggiorna anche i dati del barbiere nel localStorage generale
          const allStaff = localStorage.getItem('staff_data');
          if (allStaff) {
            const staffArray: Staff[] = JSON.parse(allStaff);
            const updatedStaffArray = staffArray.map(staff => 
              staff.id === staffId 
                ? { 
                    ...staff, 
                    full_name: profileData.full_name,
                    role: profileData.role,
                    email: profileData.email,
                    chair_id: profileData.chair_id,
                    profile_photo_url: profileData.profile_photo_url
                  }
                : staff
            );
            localStorage.setItem('staff_data', JSON.stringify(updatedStaffArray));
          }
        }
        
        return success;
      }

      // Per staff esistenti nel database, prova a salvare via API
      // Prepara i dati per l'API (solo i campi che esistono nella tabella staff)
      const staffUpdateData: Partial<Staff> = {
        id: staffId,
        full_name: profileData.full_name,
        role: profileData.role,
        email: profileData.email,
        chair_id: profileData.chair_id,
        profile_photo_url: profileData.profile_photo_url,
        phone: profileData.phone || null,
        specialties: profileData.specialties || null,
        bio: profileData.bio || null,
      };

      // Chiama l'API per aggiornare il profilo nel database
      await apiService.updateStaffProfile(staffUpdateData as Staff);
      
      // Salva anche nel localStorage per backup e accesso offline
      const success = saveBarberProfile(staffId, profileData);
      
      if (success) {
        console.log('✅ Profilo barbiere aggiornato con successo nel database:', profileData);
        
        // Aggiorna anche i dati del barbiere nel localStorage generale
        const allStaff = localStorage.getItem('staff_data');
        if (allStaff) {
          const staffArray: Staff[] = JSON.parse(allStaff);
          const updatedStaffArray = staffArray.map(staff => 
            staff.id === staffId 
              ? { 
                  ...staff, 
                  full_name: profileData.full_name,
                  role: profileData.role,
                  email: profileData.email,
                  chair_id: profileData.chair_id,
                  profile_photo_url: profileData.profile_photo_url
                }
              : staff
          );
          localStorage.setItem('staff_data', JSON.stringify(updatedStaffArray));
        }
      }
      
      return success;
    } catch (error) {
      console.error('❌ Errore nell\'aggiornamento del profilo barbiere:', error);
      // In caso di errore API, prova comunque a salvare nel localStorage
      const fallbackSuccess = saveBarberProfile(staffId, profileData);
      if (fallbackSuccess) {
        console.log('⚠️ Profilo salvato solo nel localStorage a causa di errore API');
      }
      return fallbackSuccess;
    } finally {
      setIsLoading(false);
    }
  };

  // Ottieni il profilo barbiere con fallback ai dati di base
  const getBarberProfile = useCallback((staff: Staff | null): BarberProfileData => {
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
  }, []);

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
