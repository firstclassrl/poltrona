import { useState, useEffect, useCallback, useRef } from 'react';
import { User, UserPlus } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { apiService } from '../services/api';
import { CustomerForm } from './CustomerForm';
// removed mock clients: all data comes from API
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { useAppointments } from '../hooks/useAppointments';
import { checkAppointmentOverlap } from '../utils/date';
import type { Client, CreateAppointmentRequest, UpdateAppointmentRequest, Service, Staff, Appointment } from '../types';

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateAppointmentRequest | UpdateAppointmentRequest) => void;
  appointment?: Appointment | null; // For editing existing appointments
  prefilledData?: {
    date: string;
    time: string;
    staff_id?: string;
  }; // Pre-filled data when clicking on empty slot
}

export const AppointmentForm = ({
  isOpen,
  onClose,
  onSave,
  appointment,
  prefilledData,
}: AppointmentFormProps) => {
  const [formData, setFormData] = useState({
    is_walk_in: false,
    client_id: '',
    client_name: '',
    staff_id: '',
    service_id: '',
    date: '',
    time: '',
    notes: '',
  });

  const [clientQuery, setClientQuery] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [, setSelectedClient] = useState<Client | null>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [isSearchingClients, setIsSearchingClients] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { isTimeWithinHours, isDateOpen, getAvailableTimeSlots, shopHoursLoaded } = useDailyShopHours();
  const { appointments } = useAppointments();

  // Load services and staff from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const [servicesData, staffData] = await Promise.all([
          apiService.getServices(),
          apiService.getStaff()
        ]);
        setServices(servicesData);
        setStaff(staffData);
      } catch (error) {
        console.error('Error loading appointment form data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Generate time slots based on shop hours
  const timeSlots = formData.date && shopHoursLoaded ? getAvailableTimeSlots(new Date(formData.date)) : [];
  const isEditing = !!appointment;

  useEffect(() => {
    if (appointment) {
      const startDate = new Date(appointment.start_at);
      setFormData({
        is_walk_in: !appointment.client_id && !!appointment.client_name,
        client_id: appointment.client_id || '',
        client_name: appointment.client_name || '',
        staff_id: appointment.staff_id || '',
        service_id: appointment.service_id || '',
        date: startDate.toISOString().split('T')[0],
        time: startDate.toTimeString().slice(0, 5),
        notes: appointment.notes || '',
      });
      setSelectedClient(appointment.clients || null);
      setClientQuery(
        (!appointment.client_id && appointment.client_name
          ? appointment.client_name
          : `${appointment.clients?.first_name || ''} ${appointment.clients?.last_name || ''}`.trim()
        ).trim()
      );
    } else if (prefilledData) {
      // Use prefilled data when clicking on empty slot
      setFormData({
        is_walk_in: false,
        client_id: '',
        client_name: '',
        staff_id: prefilledData.staff_id || '',
        service_id: '',
        date: prefilledData.date,
        time: prefilledData.time,
        notes: '',
      });
      setSelectedClient(null);
      setClientQuery('');
    } else {
      resetForm();
    }
  }, [appointment, prefilledData, isOpen]);

  // Reset time when date changes and time is not valid for new date
  useEffect(() => {
    if (!shopHoursLoaded) return;
    if (formData.date && formData.time) {
      const selectedDate = new Date(formData.date);
      if (!isDateOpen(selectedDate) || !isTimeWithinHours(selectedDate, formData.time)) {
        setFormData(prev => ({ ...prev, time: '' }));
      }
    }
  }, [formData.date, formData.time, isDateOpen, isTimeWithinHours, shopHoursLoaded]);

  // Reset date if a closed day is selected
  useEffect(() => {
    if (!shopHoursLoaded) return;
    if (formData.date) {
      const selectedDate = new Date(formData.date);
      if (!isDateOpen(selectedDate)) {
        setFormData(prev => ({ ...prev, date: '', time: '' }));
        setErrors(prev => ({ ...prev, date: 'Il negozio è chiuso in questa data. Seleziona un altro giorno.' }));
      } else {
        setErrors(prev => {
          const newErrors = { ...prev };
          if (newErrors.date === 'Il negozio è chiuso in questa data. Seleziona un altro giorno.') {
            delete newErrors.date;
          }
          return newErrors;
        });
      }
    }
  }, [formData.date, isDateOpen, shopHoursLoaded]);

  const resetForm = () => {
    setFormData({
      is_walk_in: false,
      client_id: '',
      client_name: '',
      staff_id: '',
      service_id: '',
      date: '',
      time: '',
      notes: '',
    });
    setSelectedClient(null);
    setClientQuery('');
    setClientSuggestions([]);
    setErrors({});
  };

  const handleClientSearch = useCallback(async (query: string) => {
    setClientQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length === 0) {
      setClientSuggestions([]);
      setShowClientSuggestions(false);
      setIsSearchingClients(false);
      return;
    }

    if (query.length === 1) {
      setShowClientSuggestions(false);
      setIsSearchingClients(false);
      return;
    }

    // Show loading state
    setIsSearchingClients(true);

    // Debounce search - wait 300ms after user stops typing
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await apiService.searchClients(query);
        setClientSuggestions(results);
        setShowClientSuggestions(true);
      } catch (error) {
        console.error('API search failed:', error);
        setClientSuggestions([]);
        setShowClientSuggestions(false);
      } finally {
        setIsSearchingClients(false);
      }
    }, 300);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setFormData(prev => ({ ...prev, is_walk_in: false, client_name: '', client_id: client.id }));
    setClientQuery(`${client.first_name} ${client.last_name || ''}`);
    setShowClientSuggestions(false);
    setErrors(prev => ({ ...prev, client_id: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!shopHoursLoaded) {
      newErrors.date = 'Caricamento orari del negozio...';
      setErrors(newErrors);
      return false;
    }

    if (formData.is_walk_in) {
      if (!formData.client_name.trim()) newErrors.client_name = 'Inserisci nome cliente';
    } else {
      if (!formData.client_id) newErrors.client_id = 'Seleziona cliente';
    }
    if (!formData.staff_id) newErrors.staff_id = 'Seleziona barbiere';
    if (!formData.service_id) newErrors.service_id = 'Seleziona servizio';
    if (!formData.date) newErrors.date = 'Seleziona data';
    if (!formData.time) newErrors.time = 'Seleziona orario';

    // Check if selected time is available
    const selectedDateTime = new Date(`${formData.date}T${formData.time}`);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDate = new Date(selectedDateTime.getFullYear(), selectedDateTime.getMonth(), selectedDateTime.getDate());

    // Check if date is valid according to shop hours
    if (!isDateOpen(selectedDate)) {
      newErrors.date = 'Il negozio è chiuso in questa data';
    }

    // Check if time is within shop hours (basic validation)
    if (!formData.time) {
      newErrors.time = 'Seleziona un orario';
    } else if (!isTimeWithinHours(selectedDate, formData.time)) {
      newErrors.time = 'Orario fuori dagli orari di apertura';
    }

    // Allow appointments for today if they are at least 1 hour in the future
    if (selectedDate.getTime() === today.getTime()) {
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      if (selectedDateTime < oneHourFromNow) {
        newErrors.time = 'Orario non disponibile (minimo 1 ora di anticipo)';
      }
    } else if (selectedDateTime < now) {
      newErrors.time = 'Non puoi prenotare nel passato';
    }

    // Check for appointment overlaps
    if (formData.staff_id && formData.service_id && formData.date && formData.time) {
      const selectedService = services.find(s => s.id === formData.service_id);
      const durationMinutes = selectedService?.duration_min || 30;
      const startAt = new Date(`${formData.date}T${formData.time}:00`);
      const endAt = new Date(startAt.getTime() + durationMinutes * 60000);

      // Filter out cancelled appointments and the current appointment if editing
      const relevantAppointments = appointments.filter(apt => {
        if (apt.status === 'cancelled') return false;
        if (isEditing && appointment && apt.id === appointment.id) return false;
        if (apt.staff_id !== formData.staff_id) return false;

        // Only check appointments on the same day
        const aptDate = new Date(apt.start_at);
        const selectedDate = new Date(formData.date);
        if (aptDate.toDateString() !== selectedDate.toDateString()) return false;

        return true;
      });

      const hasOverlap = checkAppointmentOverlap(
        {
          staff_id: formData.staff_id,
          start_at: startAt.toISOString(),
          end_at: endAt.toISOString(),
        },
        relevantAppointments
      );

      if (hasOverlap) {
        newErrors.time = 'Questo orario è già occupato per questo barbiere';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const startAt = new Date(`${formData.date}T${formData.time}`).toISOString();
      const selectedService = services.find(s => s.id === formData.service_id);
      const durationMinutes = selectedService?.duration_min || 30;
      const endAt = new Date(new Date(startAt).getTime() + durationMinutes * 60000).toISOString();

      const appointmentData = {
        client_id: formData.is_walk_in ? null : formData.client_id,
        client_name: formData.is_walk_in ? formData.client_name.trim() : undefined,
        staff_id: formData.staff_id,
        service_id: formData.service_id,
        start_at: startAt,
        end_at: endAt,
        notes: formData.notes,
        status: 'scheduled',
      };

      if (isEditing) {
        await onSave({ id: appointment.id, ...appointmentData } as UpdateAppointmentRequest);
      } else {
        await onSave(appointmentData as CreateAppointmentRequest);
      }

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error saving appointment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={isEditing ? 'Modifica Appuntamento' : 'Nuovo Appuntamento'}>
      <div className="space-y-6">
        {/* Client Selection */}
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={formData.is_walk_in}
              onChange={(e) => {
                const checked = e.target.checked;
                setFormData((prev) => ({
                  ...prev,
                  is_walk_in: checked,
                  client_id: checked ? '' : prev.client_id,
                  client_name: checked ? prev.client_name : '',
                }));
                setClientQuery('');
                setSelectedClient(null);
                setClientSuggestions([]);
                setShowClientSuggestions(false);
                setErrors((prev) => ({ ...prev, client_id: '', client_name: '' }));
              }}
              className="form-checkbox h-4 w-4 text-green-600 rounded"
            />
            <span className="text-sm text-gray-200">Cliente senza account</span>
          </div>

          {formData.is_walk_in ? (
            <Input
              label="Nome cliente"
              value={formData.client_name}
              onChange={(e) => {
                const v = e.target.value;
                setFormData((prev) => ({ ...prev, client_name: v }));
                setErrors((prev) => ({ ...prev, client_name: '' }));
              }}
              placeholder="Es. Mario Rossi"
              error={errors.client_name}
              className="flex-1"
            />
          ) : (
            <div className="flex space-x-2">
              <Input
                label="Cliente"
                value={clientQuery}
                onChange={(e) => handleClientSearch(e.target.value)}
                placeholder="Cerca cliente per nome, cognome o telefono..."
                error={errors.client_id}
                className="flex-1"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  setShowClientSuggestions(false);
                  setShowCustomerForm(true);
                }}
                className="mt-6"
                title="Crea nuovo cliente"
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          )}

          {!formData.is_walk_in && (showClientSuggestions || isSearchingClients) && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
              {isSearchingClients ? (
                <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Ricerca in corso...</span>
                </div>
              ) : clientSuggestions.length > 0 ? (
                <>
                  {clientSuggestions.map((client) => (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                      onClick={() => handleClientSelect(client)}
                    >
                      {/* Avatar with Initials */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center flex-shrink-0 border border-green-200">
                        <span className="text-green-700 font-semibold text-sm">
                          {(client.first_name[0] || '')}{(client.last_name?.[0] || '')}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="text-gray-900 font-medium truncate">
                          {client.first_name} {client.last_name || ''}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5 truncate flex items-center gap-2">
                          <span>{client.phone_e164}</span>
                          {client.email && (
                            <>
                              <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                              <span className="truncate">{client.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="p-2 bg-gray-50 sticky bottom-0 border-t border-gray-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-green-700 hover:text-green-800 hover:bg-green-50"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowClientSuggestions(false);
                        setShowCustomerForm(true);
                      }}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Crea nuovo cliente "{clientQuery}"
                    </Button>
                  </div>
                </>
              ) : (
                <div className="p-6 text-center">
                  <p className="text-gray-500 mb-4">Nessun cliente trovato</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowClientSuggestions(false);
                      setShowCustomerForm(true);
                    }}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Crea nuovo cliente
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Staff Selection */}
        <Select
          label="Barbiere"
          value={formData.staff_id}
          onChange={(e) => setFormData(prev => ({ ...prev, staff_id: e.target.value }))}
          options={[
            { value: '', label: isLoading ? 'Caricamento barbieri...' : 'Seleziona barbiere' },
            ...staff.map(staff => ({ value: staff.id, label: staff.full_name }))
          ]}
          error={errors.staff_id}
        />

        {/* Service Selection */}
        <Select
          label="Servizio"
          value={formData.service_id}
          onChange={(e) => setFormData(prev => ({ ...prev, service_id: e.target.value }))}
          options={[
            { value: '', label: isLoading ? 'Caricamento servizi...' : 'Seleziona servizio' },
            ...services.map(service => ({
              value: service.id,
              label: `${service.name} (${service.duration_min}min - €${(service.price_cents || 0) / 100})`
            }))
          ]}
          error={errors.service_id}
        />

        {/* Date & Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Data"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            error={errors.date}
            min={new Date().toISOString().split('T')[0]}
            disabled={!shopHoursLoaded}
          />

          <div>
            <Select
              label="Orario"
              value={formData.time}
              onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
              options={[
                { value: '', label: 'Seleziona orario' },
                ...timeSlots.map(time => ({ value: time, label: time }))
              ]}
              error={errors.time}
              disabled={!shopHoursLoaded || !formData.date}
            />
            {formData.date && shopHoursLoaded && (
              <p className="text-xs text-gray-500 mt-1">
                Orari disponibili: {timeSlots.length > 0 ? timeSlots[0] + ' - ' + timeSlots[timeSlots.length - 1] : 'Nessuno'}
              </p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">
            Note
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Note aggiuntive..."
            rows={3}
            className="w-full px-3 py-2 bg-white/20 border-2 border-green-500 rounded-lg text-black placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-600 backdrop-blur-sm transition-all duration-200 resize-none"
            disabled={isLoading}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4">
          <Button
            variant="secondary"
            onClick={handleClose}
            className="flex-1"
            disabled={isLoading}
          >
            Annulla
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="flex-1"
            loading={isLoading}
          >
            {isEditing ? 'Salva Modifiche' : 'Crea Appuntamento'}
          </Button>
        </div>
      </div>

      {/* Customer Form Modal */}
      <CustomerForm
        isOpen={showCustomerForm}
        onClose={() => setShowCustomerForm(false)}
        onSave={async (customerData) => {
          try {
            const newClient = await apiService.createClient(customerData);
            // Set the newly created client
            handleClientSelect(newClient);
            setShowCustomerForm(false);
            setErrors(prev => ({ ...prev, client_id: '' }));
          } catch (error) {
            console.error('Error creating client:', error);
            alert('Errore durante la creazione del cliente');
          }
        }}
        customer={null}
        mode="add"
      />
    </Modal>
  );
};