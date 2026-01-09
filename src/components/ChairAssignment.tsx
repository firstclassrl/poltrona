import { useState } from 'react';
import { Users, UserMinus } from 'lucide-react';
import { Card } from './ui/Card';
import { Select } from './ui/Select';
import { Toast } from './ui/Toast';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { useToast } from '../hooks/useToast';
import { useTerminology } from '../contexts/TerminologyContext';

export const ChairAssignment = () => {
  const {
    assignments,
    availableStaff,
    assignStaffToChair,
    unassignStaffFromChair,
  } = useChairAssignment();

  const { toast, showToast, hideToast } = useToast();
  const { professional } = useTerminology();
  const [isSaving, setIsSaving] = useState(false);

  const handleAssignStaff = async (chairId: string, staffId: string) => {
    setIsSaving(true);
    try {
      if (staffId === '') {
        await unassignStaffFromChair(chairId);
        showToast(`${professional()} rimosso dalla poltrona`, 'success');
      } else {
        await assignStaffToChair(chairId, staffId);
        showToast(`${professional()} assegnato alla poltrona con successo!`, 'success');
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
      showToast('Errore durante l\'assegnazione. Riprova.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Gestione Poltrone</h2>

      {/* Poltrone Assegnate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {assignments.map((assignment) => (
          <Card key={assignment.chairId} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${assignment.isAssigned ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                <h3 className="text-lg font-semibold text-gray-900">{assignment.chairName}</h3>
              </div>
              {isSaving && (
                <span className="text-xs text-gray-500">Salvando...</span>
              )}
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {professional()} Assegnato
              </label>
              <Select
                value={assignment.staffId || ''}
                onChange={(e) => handleAssignStaff(assignment.chairId, e.target.value)}
                disabled={isSaving}
                options={[
                  { value: '', label: `Nessun ${professional().toLowerCase()} assegnato` },
                  ...availableStaff
                    .map(staff => ({
                      value: staff.id,
                      label: staff.full_name + (staff.chair_id && staff.chair_id !== assignment.chairId ? ' (Assegnato)' : ''),
                    })),
                ]}
              />
            </div>

            {assignment.isAssigned && (
              <div className="bg-green-50 p-3 rounded-lg mt-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">
                    {assignment.staffName}
                  </span>
                </div>
              </div>
            )}

            {!assignment.isAssigned && (
              <div className="bg-gray-50 p-3 rounded-lg mt-4">
                <div className="flex items-center space-x-2">
                  <UserMinus className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-600">Poltrona disponibile</span>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
};
