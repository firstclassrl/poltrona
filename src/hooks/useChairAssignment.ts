import { useState, useEffect } from 'react';
import type { Staff } from '../types';
import { apiService } from '../services/api';

export interface ChairAssignment {
  chairId: string;
  chairName: string;
  staffId: string | null;
  staffName: string | null;
  isAssigned: boolean;
}

export const useChairAssignment = () => {
  const [assignments, setAssignments] = useState<ChairAssignment[]>([]);
  const [availableStaff, setAvailableStaff] = useState<Staff[]>([]);
  const [activeStaffId, setActiveStaffId] = useState<string>('');

  // Definizione delle poltrone (configurazione fissa)
  const defaultAssignments: ChairAssignment[] = [
    { chairId: 'chair_1', chairName: 'Poltrona 1', staffId: null, staffName: null, isAssigned: false },
    { chairId: 'chair_2', chairName: 'Poltrona 2', staffId: null, staffName: null, isAssigned: false },
  ];

  useEffect(() => {
    loadActiveStaff();
    void initializeData();
  }, []);

  const loadActiveStaff = () => {
    const savedActiveStaff = localStorage.getItem('activeStaffId');
    if (savedActiveStaff) {
      setActiveStaffId(savedActiveStaff);
    }
  };

  // Inizializza i dati caricando staff dal DB e sincronizzando le assegnazioni
  const initializeData = async () => {
    try {
      const staff = await apiService.getStaff();
      setAvailableStaff(staff);
      
      // Sincronizza le assegnazioni con i chair_id dal DB
      const syncedAssignments = defaultAssignments.map(assignment => {
        const assignedStaff = staff.find(s => s.chair_id === assignment.chairId);
        if (assignedStaff) {
          return {
            ...assignment,
            staffId: assignedStaff.id,
            staffName: assignedStaff.full_name,
            isAssigned: true,
          };
        }
        return assignment;
      });
      
      setAssignments(syncedAssignments);
      localStorage.setItem('chairAssignments', JSON.stringify(syncedAssignments));
    } catch (e) {
      console.error('Errore caricando staff da API:', e);
      setAvailableStaff([]);
      setAssignments(defaultAssignments);
    }
  };

  const loadAssignments = () => {
    // Usato solo per refresh - ora il caricamento principale è fatto da initializeData
    setAssignments(defaultAssignments);
  };

  // Funzione per ricaricare i dati dal DB
  const refreshData = async () => {
    await initializeData();
  };

  const assignStaffToChair = async (chairId: string, staffId: string): Promise<void> => {
    const staff = availableStaff.find(s => s.id === staffId);
    if (!staff) return;

    // Aggiorna il barbiere sul DB con la nuova chair_id
    await apiService.updateStaff(staffId, { chair_id: chairId });
    
    // Rimuovi chair_id dal barbiere precedentemente assegnato a questa poltrona
    const previousStaff = availableStaff.find(s => s.chair_id === chairId && s.id !== staffId);
    if (previousStaff) {
      await apiService.updateStaff(previousStaff.id, { chair_id: null });
    }

    const updatedAssignments = assignments.map(assignment => {
      if (assignment.chairId === chairId) {
        return {
          ...assignment,
          staffId,
          staffName: staff.full_name,
          isAssigned: true,
        };
      }
      // Rimuovi il barbiere da altre poltrone se era già assegnato
      if (assignment.staffId === staffId) {
        return {
          ...assignment,
          staffId: null,
          staffName: null,
          isAssigned: false,
        };
      }
      return assignment;
    });

    setAssignments(updatedAssignments);
    localStorage.setItem('chairAssignments', JSON.stringify(updatedAssignments));

    // Aggiorna anche il staff locale con la chair_id
    const updatedStaff = availableStaff.map(s => {
      if (s.id === staffId) {
        return { ...s, chair_id: chairId };
      }
      if (s.chair_id === chairId) {
        return { ...s, chair_id: null };
      }
      return s;
    });
    setAvailableStaff(updatedStaff);
  };

  const unassignStaffFromChair = async (chairId: string): Promise<void> => {
    // Trova il barbiere assegnato a questa poltrona e rimuovi la chair_id sul DB
    const assignedStaff = availableStaff.find(s => s.chair_id === chairId);
    if (assignedStaff) {
      await apiService.updateStaff(assignedStaff.id, { chair_id: null });
    }

    const updatedAssignments = assignments.map(assignment => {
      if (assignment.chairId === chairId) {
        return {
          ...assignment,
          staffId: null,
          staffName: null,
          isAssigned: false,
        };
      }
      return assignment;
    });

    setAssignments(updatedAssignments);
    localStorage.setItem('chairAssignments', JSON.stringify(updatedAssignments));

    // Rimuovi chair_id dal staff locale
    const updatedStaff = availableStaff.map(s => {
      if (s.chair_id === chairId) {
        return { ...s, chair_id: null };
      }
      return s;
    });
    setAvailableStaff(updatedStaff);
  };

  const addNewStaff = async (staffData: Omit<Staff, 'id' | 'created_at'>): Promise<Staff> => {
    // Salva il nuovo barbiere tramite API - nessun fallback locale
    const newStaff = await apiService.createStaff(staffData);
    
    // Aggiorna lo state locale solo dopo successo API
    const updatedStaff = [...availableStaff, newStaff];
    setAvailableStaff(updatedStaff);
    
    return newStaff;
  };

  const getAssignedStaff = (chairId: string): Staff | null => {
    const assignment = assignments.find(a => a.chairId === chairId);
    if (!assignment || !assignment.staffId) return null;
    return availableStaff.find(s => s.id === assignment.staffId) || null;
  };

  const getAvailableChairs = (): ChairAssignment[] => {
    return assignments.filter(a => !a.isAssigned);
  };

  const getAssignedChairs = (): ChairAssignment[] => {
    return assignments.filter(a => !!a.staffId);
  };

  const setActiveStaff = (staffId: string) => {
    setActiveStaffId(staffId);
    localStorage.setItem('activeStaffId', staffId);
  };

  const getActiveStaff = (): Staff | null => {
    return availableStaff.find(s => s.id === activeStaffId) || null;
  };

  const updateStaff = async (staffId: string, updates: Partial<Staff>): Promise<void> => {
    // Aggiorna il barbiere tramite API - nessun fallback locale
    await apiService.updateStaff(staffId, updates);
    
    // Aggiorna lo state locale solo dopo successo API
    const updatedStaff = availableStaff.map(s => 
      s.id === staffId ? { ...s, ...updates } : s
    );
    setAvailableStaff(updatedStaff);
  };

  const deleteStaff = async (staffId: string): Promise<void> => {
    // Elimina il barbiere tramite API - nessun fallback locale
    await apiService.deleteStaff(staffId);
    
    // Rimuovi il barbiere dalla lista locale solo dopo successo API
    const updatedStaff = availableStaff.filter(s => s.id !== staffId);
    setAvailableStaff(updatedStaff);

    // Rimuovi le assegnazioni di poltrone per questo barbiere
    const updatedAssignments = assignments.map(assignment => {
      if (assignment.staffId === staffId) {
        return {
          ...assignment,
          staffId: null,
          staffName: null,
          isAssigned: false,
        };
      }
      return assignment;
    });
    setAssignments(updatedAssignments);
    localStorage.setItem('chairAssignments', JSON.stringify(updatedAssignments));

    // Se il barbiere eliminato era quello attivo, seleziona il primo disponibile
    if (activeStaffId === staffId) {
      const newActiveStaff = updatedStaff.length > 0 ? updatedStaff[0].id : '';
      setActiveStaffId(newActiveStaff);
      localStorage.setItem('activeStaffId', newActiveStaff);
    }
  };

  return {
    assignments,
    availableStaff,
    activeStaffId,
    assignStaffToChair,
    unassignStaffFromChair,
    addNewStaff,
    getAssignedStaff,
    getAvailableChairs,
    getAssignedChairs,
    loadAssignments,
    setActiveStaff,
    getActiveStaff,
    updateStaff,
    deleteStaff,
    refreshData,
  };
};
