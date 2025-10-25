import { useState } from 'react';
import { Users, UserPlus, UserMinus, Edit, Trash2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { BarberForm } from './BarberForm';
import { DeleteConfirmation } from './DeleteConfirmation';

export const ChairAssignment = () => {
  const {
    assignments,
    availableStaff,
    assignStaffToChair,
    unassignStaffFromChair,
    addNewStaff,
    getAssignedChairs,
    updateStaff,
    deleteStaff,
  } = useChairAssignment();

  const [showBarberForm, setShowBarberForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleAssignStaff = (chairId: string, staffId: string) => {
    if (staffId === '') {
      unassignStaffFromChair(chairId);
    } else {
      assignStaffToChair(chairId, staffId);
    }
  };

  const handleAddNewStaff = (staffData: any) => {
    addNewStaff(staffData);
    setShowBarberForm(false);
  };

  const handleUpdateStaff = (staffData: any) => {
    if (editingStaff) {
      updateStaff(editingStaff.id, staffData);
      setShowBarberForm(false);
      setEditingStaff(null);
    }
  };

  const handleEditStaff = (staff: any) => {
    setEditingStaff(staff);
    setShowBarberForm(true);
  };

  const handleDeleteStaff = (staff: any) => {
    setStaffToDelete(staff);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    
    setIsDeleting(true);
    try {
      deleteStaff(staffToDelete.id);
      setShowDeleteConfirmation(false);
      setStaffToDelete(null);
    } catch (error) {
      console.error('Error deleting staff:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDeleteStaff = () => {
    setShowDeleteConfirmation(false);
    setStaffToDelete(null);
  };

  const assignedChairs = getAssignedChairs();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-gray-900">Gestione Poltrone e Barbieri</h2>
        <Button onClick={() => setShowBarberForm(true)}>
          <UserPlus className="w-5 h-5 mr-2" />
          Aggiungi Barbiere
        </Button>
      </div>

      {/* Poltrone Assegnate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {assignments.map((assignment) => (
          <Card key={assignment.chairId} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${assignment.isAssigned ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <h3 className="text-lg font-semibold text-gray-900">{assignment.chairName}</h3>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Barbiere Assegnato
                </label>
                <Select
                  value={assignment.staffId || ''}
                  onChange={(e) => handleAssignStaff(assignment.chairId, e.target.value)}
                  options={[
                    { value: '', label: 'Nessun barbiere assegnato' },
                    ...availableStaff
                      .filter(staff => !staff.chair_id || staff.chair_id === assignment.chairId)
                      .map(staff => ({
                        value: staff.id,
                        label: staff.full_name,
                      })),
                  ]}
                />
              </div>

              {assignment.isAssigned && (
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">
                      {assignment.staffName} - {availableStaff.find(s => s.id === assignment.staffId)?.role}
                    </span>
                  </div>
                </div>
              )}

              {!assignment.isAssigned && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <UserMinus className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600">Poltrona disponibile</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Gestione Barbieri */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Gestione Barbieri</h3>
        <p className="text-sm text-gray-600 mb-6">Qui puoi modificare o eliminare i barbieri del negozio</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableStaff.map((staff) => (
            <div key={staff.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  {staff.profile_photo_url ? (
                    <img
                      src={staff.profile_photo_url}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <Users className="w-6 h-6 text-white" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{staff.full_name}</div>
                  <div className="text-sm text-gray-500">{staff.role}</div>
                  <div className="text-xs text-gray-400">
                    {staff.chair_id ? `Assegnato a ${staff.chair_id.replace('chair_', 'Poltrona ')}` : 'Non assegnato'}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleEditStaff(staff)}
                  title="Modifica barbiere"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDeleteStaff(staff)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  title="Elimina barbiere"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Riepilogo */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Riepilogo Assegnazioni</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{assignments.length}</div>
            <div className="text-sm text-gray-600">Poltrone Totali</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{assignedChairs.length}</div>
            <div className="text-sm text-gray-600">Poltrone Assegnate</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{availableStaff.filter(staff => !staff.chair_id).length}</div>
            <div className="text-sm text-gray-600">Barbieri Disponibili</div>
          </div>
        </div>
      </Card>

      {/* Form per aggiungere/modificare barbiere */}
      {showBarberForm && (
        <BarberForm
          isOpen={showBarberForm}
          onClose={() => {
            setShowBarberForm(false);
            setEditingStaff(null);
          }}
          onSave={editingStaff ? handleUpdateStaff : handleAddNewStaff}
          staff={editingStaff}
          mode={editingStaff ? 'edit' : 'add'}
        />
      )}

      {/* Conferma Eliminazione */}
      <DeleteConfirmation
        isOpen={showDeleteConfirmation}
        onClose={cancelDeleteStaff}
        onConfirm={confirmDeleteStaff}
        title="Elimina Barbiere"
        message="Sei sicuro di voler eliminare questo barbiere? Questa azione non può essere annullata."
        itemName={staffToDelete?.full_name || ''}
        isLoading={isDeleting}
      />
    </div>
  );
};
