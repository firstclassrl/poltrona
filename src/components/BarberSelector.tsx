import { useState } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import { useChairAssignment } from '../hooks/useChairAssignment';
import { useTerminology } from '../contexts/TerminologyContext';

interface BarberSelectorProps {
  onBarberSelect?: (staffId: string) => void;
  className?: string;
}

export const BarberSelector = ({ onBarberSelect, className = '' }: BarberSelectorProps) => {
  const { availableStaff, activeStaffId, setActiveStaff, getActiveStaff } = useChairAssignment();
  const { selectProfessional, noProfessionals, professional } = useTerminology();
  const [isOpen, setIsOpen] = useState(false);

  const activeStaff = getActiveStaff();
  const selectLabel = selectProfessional();
  const noStaffLabel = `Nessun ${professional().toLowerCase()} selezionato`;

  const handleBarberSelect = (staffId: string) => {
    setActiveStaff(staffId);
    onBarberSelect?.(staffId);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="secondary"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        <div className="flex items-center space-x-3">
          <Avatar
            name={activeStaff?.full_name || selectLabel}
            size="sm"
            imageUrl={activeStaff?.profile_photo_url || undefined}
          />
          <div className="text-left">
            <div className="font-medium text-gray-900">
              {activeStaff?.full_name || selectLabel}
            </div>
            <div className="text-sm text-gray-500">
              {activeStaff?.role || noStaffLabel}
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {availableStaff.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {noProfessionals}
            </div>
          ) : (
            availableStaff.map((staff) => (
              <button
                key={staff.id}
                onClick={() => handleBarberSelect(staff.id)}
                className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${activeStaffId === staff.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
              >
                <div className="flex items-center space-x-3">
                  <Avatar
                    name={staff.full_name}
                    size="md"
                    imageUrl={staff.profile_photo_url || undefined}
                  />
                  <div>
                    <div className="font-medium text-gray-900">{staff.full_name}</div>
                    <div className="text-sm text-gray-500">{staff.role}</div>
                    {staff.chair_id && (
                      <div className="text-xs text-blue-600">
                        {staff.chair_id.replace('chair_', 'Poltrona ')}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Overlay per chiudere il dropdown */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
