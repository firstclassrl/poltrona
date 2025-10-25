import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Modal } from './ui/Modal';
import { apiService } from '../services/api';
// removed mock clients: all data comes from API
import { generateTimeSlots } from '../utils/date';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import type { Client, CreateAppointmentRequest, UpdateAppointmentRequest, Service, Staff } from '../types';

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateAppointmentRequest | UpdateAppointmentRequest) => void;
  appointment?: any; // For editing existing appointments
}

export const AppointmentForm = ({
  isOpen,
  onClose,
  onSave,
  appointment,
}: AppointmentFormProps) => {
  const [formData, setFormData] = useState({
    client_id: '',
    staff_id: '',
    service_id: '',
    date: '',
    time: '',
    notes: '',
    reminder_channel: 'whatsapp' as 'whatsapp' | 'email',
  });
  
  const [clientQuery, setClientQuery] = useState('');
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [, setSelectedClient] = useState<Client | null>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { isTimeWithinHours, isDateOpen, getAvailableTimeSlots } = useDailyShopHours();

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
  const timeSlots = formData.date ? getAvailableTimeSlots(new Date(formData.date)) : generateTimeSlots();
  const isEditing = !!appointment;

  useEffect(() => {
    if (appointment) {
      const startDate = new Date(appointment.start_at);
      setFormData({
        client_id: appointment.client_id,
        staff_id: appointment.staff_id,
        service_id: appointment.service_id,
        date: startDate.toISOString().split('T')[0],
        time: startDate.toTimeString().slice(0, 5),
        notes: appointment.notes || '',
        reminder_channel: (appointment as any).reminder_channel || 'whatsapp',
      });
      setSelectedClient(appointment.clients);
      setClientQuery(`${appointment.clients?.first_name} ${appointment.clients?.last_name}`);
    } else {
      resetForm();
    }
  }, [appointment, isOpen]);

  // Reset time when date changes and time is not valid for new date
  useEffect(() => {
    if (formData.date && formData.time) {
      const selectedDate = new Date(formData.date);
      if (!isDateOpen(selectedDate) || !isTimeWithinHours(selectedDate, formData.time)) {
        setFormData(prev => ({ ...prev, time: '' }));
      }
    }
  }, [formData.date, isDateOpen, isTimeWithinHours]);

  const resetForm = () => {
    setFormData({
      client_id: '',
      staff_id: '',
      service_id: '',
      date: '',
      time: '',
      notes: '',
      reminder_channel: 'whatsapp',
    });
    setSelectedClient(null);
    setClientQuery('');
    setClientSuggestions([]);
    setErrors({});
  };

  const handleClientSearch = async (query: string) => {
    setClientQuery(query);
    if (query.length > 1) {
      try {
        const results = await apiService.searchClients(query);
        setClientSuggestions(results);
        setShowClientSuggestions(true);
      } catch (error) {
        console.error('API search failed:', error);
        setClientSuggestions([]);
        setShowClientSuggestions(false);
      }
    } else if (query.length === 0) {
      setClientSuggestions([]);
      setShowClientSuggestions(false);
    } else {
      setShowClientSuggestions(false);
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    setFormData(prev => ({ ...prev, client_id: client.id }));
    setClientQuery(`${client.first_name} ${client.last_name || ''}`);
    setShowClientSuggestions(false);
    setErrors(prev => ({ ...prev, client_id: '' }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.client_id) newErrors.client_id = 'Seleziona cliente';
    if (!formData.staff_id) newErrors.staff_id = 'Seleziona barbiere';
    if (!formData.service_id) newErrors.service_id = 'Seleziona servizio';
    if (!formData.date) newErrors.date = 'Seleziona data';
    if (!formData.time) newErrors.time = 'Seleziona orario';

    // Check if selected time is available
    const selectedDateTime = new Date(`${formData.date}T${formData.time}`);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selectedDate = new Date(selectedDateTime.getFullYear(), selectedDateTime.getMonth(), selectedDateTime.getDate());
    
    // Check if date is valid (not Sunday)
    if (!isDateValid(selectedDate)) {
      newErrors.date = 'Il negozio è chiuso la domenica';
    }
    
    // Check if time is within shop hours
    if (!isTimeWithinHours(formData.time)) {
      newErrors.time = 'Orario fuori dagli orari di apertura del negozio';
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
        client_id: formData.client_id,
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
          <div className="flex space-x-2">
            <Input
              label="Cliente"
              value={clientQuery}
              onChange={(e) => handleClientSearch(e.target.value)}
              placeholder="Cerca cliente per nome o telefono..."
              error={errors.client_id}
              className="flex-1"
            />
            {/* Rimosso bottone mock "Tutti" in produzione */}
          </div>
          
          {showClientSuggestions && clientSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-white/20 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {clientSuggestions.map((client) => (
                <div
                  key={client.id}
                  className="p-3 hover:bg-white/10 cursor-pointer transition-colors"
                  onClick={() => handleClientSelect(client)}
                >
                  <div className="text-white font-medium">
                    {client.first_name} {client.last_name}
                  </div>
                  <div className="text-gray-300 text-sm">{client.phone_e164}</div>
                </div>
              ))}
              <div className="p-3 border-t border-white/10">
                <Button variant="ghost" size="sm" className="w-full">
                  <User className="w-4 h-4 mr-2" />
                  Crea nuovo cliente
                </Button>
              </div>
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
            />
            {formData.date && (
              <p className="text-xs text-gray-500 mt-1">
                Orari disponibili: {timeSlots.length > 0 ? timeSlots[0] + ' - ' + timeSlots[timeSlots.length - 1] : 'Nessuno'}
              </p>
            )}
          </div>
        </div>

        {/* Reminder Channel */}
        <Select
          label="Canale Reminder"
          value={formData.reminder_channel}
          onChange={(e) => setFormData(prev => ({ ...prev, reminder_channel: e.target.value as any }))}
          options={[
            { value: 'whatsapp', label: 'WhatsApp' },
            { value: 'email', label: 'Email' },
          ]}
        />

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
    </Modal>
  );
};