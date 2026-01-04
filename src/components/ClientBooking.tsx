import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Scissors, Plus, Check, Bell, X, AlertCircle } from 'lucide-react';
import { Button } from './ui/Button';
import { Select } from './ui/Select';
import { Card } from './ui/Card';
import { useDailyShopHours } from '../hooks/useDailyShopHours';
import { apiService } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useShop } from '../contexts/ShopContext';
import type { Service, Staff, WaitlistEntry } from '../types';

// Helper per ottenere i prossimi 7 giorni (oggi + 6 giorni successivi)
const getNextSevenDays = (): Date[] => {
  const days: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < 7; i++) {
    const day = new Date(today);
    day.setDate(today.getDate() + i);
    days.push(day);
  }
  
  return days;
};

// Formatta la data in formato YYYY-MM-DD
const formatDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Formatta la data per visualizzazione
const formatDateDisplay = (date: Date): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(today.getDate() + 2);
  
  if (date.getTime() === today.getTime()) {
    return 'Oggi';
  } else if (date.getTime() === tomorrow.getTime()) {
    return 'Domani';
  } else if (date.getTime() === dayAfterTomorrow.getTime()) {
    return 'Dopodomani';
  }
  
  return date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const ClientBooking: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { currentShop, currentShopId, isLoading: shopLoading } = useShop();
  const { getAvailableTimeSlots, isDateOpen, shopHoursLoaded } = useDailyShopHours();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Waitlist state
  const [clientId, setClientId] = useState<string | null>(null);
  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [isJoiningWaitlist, setIsJoiningWaitlist] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistError, setWaitlistError] = useState<string | null>(null);
  const [selectedWaitlistDates, setSelectedWaitlistDates] = useState<string[]>([]);
  const [waitlistService, setWaitlistService] = useState('');
  const [waitlistBarber, setWaitlistBarber] = useState('');

  // Load services and staff from API - wait for shop to be loaded first
  useEffect(() => {
    // Don't load services until shop is loaded and we have a shop_id
    if (shopLoading || (!currentShopId && !currentShop)) {
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        // Ensure shop_id is in localStorage before calling getServices
        if (currentShopId && currentShopId !== 'default') {
          localStorage.setItem('current_shop_id', currentShopId);
        } else if (currentShop?.id && currentShop.id !== 'default') {
          localStorage.setItem('current_shop_id', currentShop.id);
        }
        
        const [servicesData, staffData] = await Promise.all([
          apiService.getServices(),
          apiService.getStaff()
        ]);
        setServices(servicesData);
        setStaff(staffData);
        
        if (servicesData.length === 0) {
        }
      } catch (error) {
        console.error('❌ Error loading booking data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [shopLoading, currentShopId, currentShop]);

  // Ottieni il client_id dall'utente autenticato
  useEffect(() => {
    const getClientId = async () => {
      if (user?.email) {
        try {
          // Ottieni il token di accesso da localStorage o sessionStorage
          const accessToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
          
          if (!accessToken) {
            return;
          }
          
          
          const clientRecord = await apiService.getOrCreateClientFromUser({
            id: user.id,
            email: user.email,
            full_name: user.full_name,
          }, { accessToken });
          
          setClientId(clientRecord.id);
          
          // Carica lo stato della waitlist per questo cliente
          const entries = await apiService.getClientWaitlistStatus(clientRecord.id);
          setWaitlistEntries(entries);
        } catch (error) {
          console.error('❌ Error getting client ID for user:', error);
          // Non impostare clientId se c'è un errore, così l'utente può vedere il problema
        }
      }
    };

    getClientId();
  }, [user]);

  // Get available time slots for selected date
  const timeSlots = selectedDate && shopHoursLoaded ? getAvailableTimeSlots(new Date(selectedDate)) : [];

  // Filter barbers based on selected service and availability
  const availableBarbers = staff.filter(staff => 
    staff.active && staff.chair_id // Only assigned barbers
  );

  // Check if date is valid (shop is open)
  const isDateValid = (date: Date) => {
    return shopHoursLoaded && isDateOpen(date);
  };

  // Ottieni i prossimi 7 giorni aperti per la waitlist
  const nextSevenDays = getNextSevenDays();
  const openDays = nextSevenDays.filter(day => shopHoursLoaded && isDateOpen(day));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verifica autenticazione
    if (!isAuthenticated || !user) {
      alert('Devi essere autenticato per prenotare un appuntamento. Vai al login.');
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    
    // Verifica token
    const accessToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!accessToken) {
      alert('Token di autenticazione non trovato. Effettua il login di nuovo.');
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    
    if (!clientId) {
      console.error('❌ Client ID non disponibile. Assicurati di essere autenticato.');
      alert('Errore: Client ID non disponibile. Ricarica la pagina e riprova.');
      return;
    }

    if (!selectedDate || !selectedTime || !selectedService || !selectedBarber) {
      console.error('❌ Dati mancanti per la prenotazione');
      return;
    }

    setIsSubmitting(true);

    try {
      // Ottieni il servizio e il barbiere selezionati
      const service = services.find(s => s.id === selectedService);
      const barber = staff.find(s => s.id === selectedBarber);

      if (!service || !barber) {
        throw new Error('Servizio o barbiere non trovato');
      }

      // Crea la data/ora di inizio e fine
      const startDateTime = new Date(`${selectedDate}T${selectedTime}`);
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(endDateTime.getMinutes() + service.duration_min);


      // Crea l'appuntamento usando l'API
      // Nota: createAppointmentDirect usa buildHeaders(true) che legge il token da localStorage
      await apiService.createAppointmentDirect({
        client_id: clientId,
        client_name: user?.full_name || 'Cliente',
        staff_id: selectedBarber,
        service_id: selectedService,
        start_at: startDateTime.toISOString(),
        end_at: endDateTime.toISOString(),
        notes: '',
        status: 'confirmed',
      });

      
      setIsSuccess(true);
      // Reset form
      setSelectedDate('');
      setSelectedTime('');
      setSelectedService('');
      setSelectedBarber('');
      
      // Hide success message after 3 seconds
      setTimeout(() => setIsSuccess(false), 3000);
    } catch (error) {
      console.error('❌ Error booking appointment:', error);
      // Mostra un messaggio di errore all'utente
      alert('Errore durante la prenotazione. Assicurati di essere autenticato e che tutti i dati siano corretti.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle selezione data per waitlist
  const toggleWaitlistDate = (date: Date) => {
    const dateStr = formatDateISO(date);
    setSelectedWaitlistDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        return [...prev, dateStr];
      }
    });
  };

  // Mettersi in coda
  const handleJoinWaitlist = async () => {
    if (!clientId || selectedWaitlistDates.length === 0) {
      setWaitlistError('Seleziona almeno una data');
      return;
    }

    setIsJoiningWaitlist(true);
    setWaitlistError(null);

    try {
      // TODO: Il sistema waitlist attuale richiede un appointment_id esistente
      // Questo componente usa un sistema diverso con date preferite
      // Per ora disabilitiamo questa funzionalità fino a quando non sarà implementata l'API corretta
      setWaitlistError('Funzionalità in fase di sviluppo. Il sistema waitlist richiede un appuntamento esistente.');
      setIsJoiningWaitlist(false);
      return;

      // Codice originale commentato - da aggiornare quando l'API supporterà date preferite
      /*
      const entry = await apiService.joinWaitlist({
        client_id: clientId,
        preferred_dates: selectedWaitlistDates,
        service_id: waitlistService || undefined,
        staff_id: waitlistBarber || undefined,
      });

      if (entry) {
        setWaitlistEntries(prev => [entry, ...prev]);
        setWaitlistSuccess(true);
        setSelectedWaitlistDates([]);
        setWaitlistService('');
        setWaitlistBarber('');
        
        setTimeout(() => setWaitlistSuccess(false), 5000);
      }
      */
    } catch (error) {
      console.error('Error joining waitlist:', error);
      setWaitlistError('Errore durante l\'iscrizione alla lista d\'attesa');
    } finally {
      setIsJoiningWaitlist(false);
    }
  };

  // Rimuoversi dalla coda
  const handleLeaveWaitlist = async (waitlistId: string) => {
    try {
      await apiService.leaveWaitlist(waitlistId);
      setWaitlistEntries(prev => prev.filter(e => e.id !== waitlistId));
    } catch (error) {
      console.error('Error leaving waitlist:', error);
    }
  };

  const isFormValid = shopHoursLoaded && selectedDate && selectedTime && selectedService && selectedBarber;

  // Verifica anche direttamente il token per essere sicuri
  const hasToken = typeof window !== 'undefined' && (
    localStorage.getItem('auth_token') || 
    sessionStorage.getItem('auth_token')
  );

  // Mostra messaggio se l'utente non è autenticato O se non c'è token
  if ((!authLoading && !isAuthenticated) || (!authLoading && !hasToken && !user)) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Prenota Appuntamento</h1>
          <p className="text-gray-600 mt-2">Scegli il servizio e prenota il tuo appuntamento</p>
        </div>
        <Card className="max-w-2xl mx-auto">
          <div className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Autenticazione Richiesta</h2>
            <p className="text-gray-600 mb-4">
              Devi effettuare il login per prenotare un appuntamento.
            </p>
            <Button
              onClick={() => {
                // Reindirizza alla pagina di login mantenendo l'URL corrente per il redirect
                window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
              }}
            >
              Vai al Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Mostra loading se l'autenticazione è in corso
  if (authLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Prenota Appuntamento</h1>
          <p className="text-gray-600 mt-2">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Prenota Appuntamento</h1>
        <p className="text-gray-600 mt-2">Scegli il servizio e prenota il tuo appuntamento</p>
      </div>

      {!shopHoursLoaded && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-600">
          Caricamento orari del negozio...
        </div>
      )}

      {isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-green-800 font-medium">Appuntamento prenotato con successo!</p>
          </div>
        </div>
      )}

      <Card className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          {/* Servizio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Scissors className="w-4 h-4 inline mr-2" />
              Servizio
            </label>
            <Select
              value={selectedService}
              onChange={(e) => {
                setSelectedService(e.target.value);
                setSelectedBarber(''); // Reset barber when service changes
              }}
              options={[
                { value: '', label: isLoading ? 'Caricamento servizi...' : 'Seleziona un servizio' },
                ...services
                  .filter(service => service.active)
                  .map(service => ({
                    value: service.id,
                    label: `${service.name} - €${(service.price_cents || 0) / 100} (${service.duration_min} min)`,
                  })),
              ]}
              required
              disabled={isLoading}
            />
          </div>

          {/* Barbiere */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-2" />
              Barbiere
            </label>
            <Select
              value={selectedBarber}
              onChange={(e) => setSelectedBarber(e.target.value)}
              options={[
                { value: '', label: isLoading ? 'Caricamento barbieri...' : 'Seleziona un barbiere' },
                ...availableBarbers.map(barber => ({
                  value: barber.id,
                  label: barber.full_name,
                })),
              ]}
              required
              disabled={!selectedService || isLoading}
            />
          </div>

          {/* Data */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedTime(''); // Reset time when date changes
              }}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={!shopHoursLoaded}
            />
            {selectedDate && !isDateValid(new Date(selectedDate)) && (
              <p className="text-red-500 text-sm mt-1">
                {shopHoursLoaded ? 'Il negozio è chiuso in questa data' : 'Caricamento orari del negozio...'}
              </p>
            )}
          </div>

          {/* Orario */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Orario
            </label>
            <Select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              options={[
                { value: '', label: 'Seleziona un orario' },
                ...timeSlots.map(time => ({ value: time, label: time })),
              ]}
              required
              disabled={!shopHoursLoaded || !selectedDate || !isDateValid(new Date(selectedDate))}
            />
            {selectedDate && shopHoursLoaded && timeSlots.length === 0 && isDateValid(new Date(selectedDate)) && (
              <p className="text-gray-500 text-sm mt-1">Nessun orario disponibile per questa data</p>
            )}
          </div>

          {/* Riepilogo */}
          {isFormValid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 mb-2">Riepilogo Prenotazione</h3>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>Servizio:</strong> {services.find(s => s.id === selectedService)?.name}</p>
                <p><strong>Barbiere:</strong> {availableBarbers.find(b => b.id === selectedBarber)?.full_name}</p>
                <p><strong>Data:</strong> {new Date(selectedDate).toLocaleDateString('it-IT')}</p>
                <p><strong>Orario:</strong> {selectedTime}</p>
                <p><strong>Durata:</strong> {services.find(s => s.id === selectedService)?.duration_min} minuti</p>
                <p><strong>Prezzo:</strong> €{(services.find(s => s.id === selectedService)?.price_cents || 0) / 100}</p>
              </div>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              'Prenotazione in corso...'
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Prenota Appuntamento
              </>
            )}
          </Button>
        </form>
      </Card>

      {/* Sezione Lista d'Attesa */}
      {clientId && (
        <Card className="max-w-2xl mx-auto">
          <div className="p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Bell className="w-5 h-5 text-amber-600" />
              <h3 className="text-lg font-semibold text-gray-900">Mettiti in Coda</h3>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              Non trovi posto? Mettiti in lista d'attesa e ti avviseremo se si libera un posto!
            </p>

            {waitlistSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <Check className="w-5 h-5 text-green-600" />
                  <p className="text-green-800 text-sm">
                    Sei stato aggiunto alla lista d'attesa! Ti avviseremo se si libera un posto.
                  </p>
                </div>
              </div>
            )}

            {waitlistError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-800 text-sm">{waitlistError}</p>
                </div>
              </div>
            )}

            {/* Selezione giorni */}
            {shopHoursLoaded && openDays.length > 0 ? (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Seleziona i giorni in cui vorresti un posto:
                </label>
                <div className="flex flex-wrap gap-2">
                  {openDays.map(day => {
                    const dateStr = formatDateISO(day);
                    const isSelected = selectedWaitlistDates.includes(dateStr);
                    
                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => toggleWaitlistDate(day)}
                        className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                          isSelected 
                            ? 'bg-amber-100 border-amber-500 text-amber-800' 
                            : 'bg-white border-gray-200 text-gray-700 hover:border-amber-300'
                        }`}
                      >
                        <div className="text-sm font-medium">{formatDateDisplay(day)}</div>
                        <div className="text-xs text-gray-500">
                          {day.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : shopHoursLoaded && openDays.length === 0 ? (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  Non ci sono giorni aperti nei prossimi 7 giorni. Controlla le tue richieste in lista d'attesa qui sotto.
                </p>
              </div>
            ) : (
              <div className="mb-4 bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  Caricamento orari del negozio...
                </p>
              </div>
            )}

            {/* Preferenze opzionali */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Servizio preferito (opzionale)
                </label>
                <Select
                  value={waitlistService}
                  onChange={(e) => setWaitlistService(e.target.value)}
                  options={[
                    { value: '', label: 'Qualsiasi servizio' },
                    ...services
                      .filter(service => service.active)
                      .map(service => ({
                        value: service.id,
                        label: service.name,
                      })),
                  ]}
                  disabled={isLoading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Barbiere preferito (opzionale)
                </label>
                <Select
                  value={waitlistBarber}
                  onChange={(e) => setWaitlistBarber(e.target.value)}
                  options={[
                    { value: '', label: 'Qualsiasi barbiere' },
                    ...availableBarbers.map(barber => ({
                      value: barber.id,
                      label: barber.full_name,
                    })),
                  ]}
                  disabled={isLoading}
                />
              </div>
            </div>

            {shopHoursLoaded && openDays.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                className="w-full bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300 mb-6"
                onClick={handleJoinWaitlist}
                disabled={isJoiningWaitlist || selectedWaitlistDates.length === 0 || !clientId}
              >
                {isJoiningWaitlist ? (
                  'Iscrizione in corso...'
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Mettiti in Coda
                  </>
                )}
              </Button>
            )}

            {/* Le tue richieste in coda */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Le tue richieste in lista d'attesa:</h4>
              {waitlistEntries.length > 0 ? (
                <div className="space-y-2">
                  {waitlistEntries.map(entry => (
                    <div 
                      key={entry.id} 
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        entry.status === 'notified' 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          {entry.status === 'notified' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Posto disponibile!
                            </span>
                          )}
                          <span className="text-sm text-gray-600">
                            {entry.appointment_id ? (
                              // Mostra la data dell'appuntamento collegato se disponibile
                              'Appuntamento collegato'
                            ) : (
                              'Nessuna data disponibile'
                            )}
                          </span>
                        </div>
                        {(entry.services || entry.staff) && (
                          <div className="text-xs text-gray-500 mt-1">
                            {entry.services?.name && `Servizio: ${entry.services.name}`}
                            {entry.services?.name && entry.staff?.full_name && ' • '}
                            {entry.staff?.full_name && `Barbiere: ${entry.staff.full_name}`}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLeaveWaitlist(entry.id)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title="Rimuovi dalla lista d'attesa"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Nessuna richiesta in lista d'attesa al momento.
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Informazioni */}
      <Card className="max-w-2xl mx-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Informazioni</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4" />
              <span>Orari: 09:00 - 19:00 (Chiuso la domenica)</span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4" />
              <span>Prenotazione minima: 1 ora di anticipo</span>
            </div>
            <div className="flex items-center space-x-2">
              <User className="w-4 h-4" />
              <span>Puoi modificare o cancellare la prenotazione fino a 2 ore prima</span>
            </div>
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4" />
              <span>Lista d'attesa: ricevi una notifica se si libera un posto</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
