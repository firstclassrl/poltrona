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

  useEffect(() => {
    loadAssignments();
    loadActiveStaff();
    void loadStaffFromApi();
  }, []);

  const loadActiveStaff = () => {
    const savedActiveStaff = localStorage.getItem('activeStaffId');
    if (savedActiveStaff) {
      setActiveStaffId(savedActiveStaff);
    }
  };

  const loadAssignments = () => {
    // Carica le assegnazioni salvate (se esistono); altrimenti inizializza poltrone vuote
    const savedAssignments = localStorage.getItem('chairAssignments');
    if (savedAssignments) {
      const parsed: ChairAssignment[] = JSON.parse(savedAssignments).map((a: any) => ({
        chairId: a.chairId,
        chairName: a.chairName,
        staffId: a.staffId ?? null,
        staffName: a.staffName ?? null,
        isAssigned: !!a.staffId,
      }));
      setAssignments(parsed);
      localStorage.setItem('chairAssignments', JSON.stringify(parsed));
      return;
    }
    const emptyAssignments: ChairAssignment[] = [
      { chairId: 'chair_1', chairName: 'Poltrona 1', staffId: null, staffName: null, isAssigned: false },
      { chairId: 'chair_2', chairName: 'Poltrona 2', staffId: null, staffName: null, isAssigned: false },
    ];
    setAssignments(emptyAssignments);
    localStorage.setItem('chairAssignments', JSON.stringify(emptyAssignments));
  };

  const loadStaffFromApi = async () => {
    try {
      const staff = await apiService.getStaff();
      setAvailableStaff(staff);
      localStorage.setItem('availableStaff', JSON.stringify(staff));
    } catch (e) {
      console.error('Errore caricando staff da API:', e);
      setAvailableStaff([]);
    }
  };

  const assignStaffToChair = (chairId: string, staffId: string) => {
    const staff = availableStaff.find(s => s.id === staffId);
    if (!staff) return;

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

    // Aggiorna anche il staff con la chair_id
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
    localStorage.setItem('availableStaff', JSON.stringify(updatedStaff));
  };

  const unassignStaffFromChair = (chairId: string) => {
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

    // Rimuovi chair_id dal staff
    const updatedStaff = availableStaff.map(s => {
      if (s.chair_id === chairId) {
        return { ...s, chair_id: null };
      }
      return s;
    });
    setAvailableStaff(updatedStaff);
    localStorage.setItem('availableStaff', JSON.stringify(updatedStaff));
  };

  const addNewStaff = (staffData: Omit<Staff, 'id' | 'created_at'>) => {
    const newStaff: Staff = {
      ...staffData,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
    };

    const updatedStaff = [...availableStaff, newStaff];
    setAvailableStaff(updatedStaff);
    localStorage.setItem('availableStaff', JSON.stringify(updatedStaff));
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

  const updateStaff = (staffId: string, updates: Partial<Staff>) => {
    const updatedStaff = availableStaff.map(s => 
      s.id === staffId ? { ...s, ...updates } : s
    );
    setAvailableStaff(updatedStaff);
    localStorage.setItem('availableStaff', JSON.stringify(updatedStaff));
  };

  const deleteStaff = (staffId: string) => {
    // Rimuovi il barbiere dalla lista
    const updatedStaff = availableStaff.filter(s => s.id !== staffId);
    setAvailableStaff(updatedStaff);
    localStorage.setItem('availableStaff', JSON.stringify(updatedStaff));

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
  };
};
