import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Phone, Mail, User, Plus, Calendar } from 'lucide-react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';
import { CustomerForm } from './CustomerForm';
import { apiService } from '../services/api';
import type { Client, Appointment } from '../types';
import { formatDate } from '../utils/date';

interface ClientsProps {
  onNavigateToBooking?: () => void;
}

export const Clients = ({ onNavigateToBooking }: ClientsProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [, setIsSearching] = useState(false);
  const [, setIsClientsLoading] = useState(false);

  const loadClients = useCallback(async () => {
    setIsClientsLoading(true);
    try {
      const results = await apiService.searchClients('');
      setClients(results);
    } catch (error) {
      console.error('Errore caricamento clienti:', error);
      setClients([]);
    } finally {
      setIsClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>(clients);
  const [sortBy, setSortBy] = useState<'name' | 'created'>('name');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [customerFormMode, setCustomerFormMode] = useState<'add' | 'edit'>('add');
  const [editingCustomer, setEditingCustomer] = useState<Client | null>(null);
  const [clientAppointments, setClientAppointments] = useState<Appointment[]>([]);
  const [isLoadingAppointments, setIsLoadingAppointments] = useState(false);

  // Memoized sorted and filtered clients
  const sortedAndFilteredClients = useMemo(() => {
    // First filter
    let filtered = clients.filter(client => 
      client.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.last_name && client.last_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      client.phone_e164.includes(searchQuery)
    );

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        // Ordine alfabetico per nome completo (nome + cognome)
        const nameA = `${a.first_name} ${a.last_name || ''}`.trim().toLowerCase();
        const nameB = `${b.first_name} ${b.last_name || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB, 'it');
      } else if (sortBy === 'created') {
        // Ordine per data di creazione (più recenti prima)
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA;
      }
      return 0;
    });

    return sorted;
  }, [clients, searchQuery, sortBy]);

  useEffect(() => {
    setFilteredClients(sortedAndFilteredClients);
  }, [sortedAndFilteredClients]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      setIsSearching(true);
      try {
        const results = await apiService.searchClients(query);
        setFilteredClients(results);
      } catch (error) {
        console.error('Search failed:', error);
        // Fallback to local filtering
      } finally {
        setIsSearching(false);
      }
    }
  };

  const loadClientAppointments = useCallback(async (clientId: string) => {
    setIsLoadingAppointments(true);
    try {
      // Carica appuntamenti degli ultimi 2 anni fino a 1 anno nel futuro
      const today = new Date();
      const startDate = new Date(today);
      startDate.setFullYear(today.getFullYear() - 2);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(today);
      endDate.setFullYear(today.getFullYear() + 1);
      endDate.setHours(23, 59, 59, 999);
      
      const appointments = await apiService.getAppointments(
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      // Filtra per client_id
      const clientAppts = appointments.filter(apt => apt.client_id === clientId);
      setClientAppointments(clientAppts);
    } catch (error) {
      console.error('Errore caricamento appuntamenti cliente:', error);
      setClientAppointments([]);
    } finally {
      setIsLoadingAppointments(false);
    }
  }, []);

  const openClientModal = (client: Client) => {
    setSelectedClient(client);
    setIsModalOpen(true);
    if (client.id) {
      loadClientAppointments(client.id);
    }
  };

  const handleNewCustomer = () => {
    setCustomerFormMode('add');
    setEditingCustomer(null);
    setIsCustomerFormOpen(true);
  };

  const handleEditCustomer = (client: Client) => {
    setCustomerFormMode('edit');
    setEditingCustomer(client);
    setIsCustomerFormOpen(true);
  };

  const handleSaveCustomer = async (customerData: Partial<Client>) => {
    try {
      setIsClientsLoading(true);
      if (customerFormMode === 'add') {
        await apiService.createClient(customerData);
      } else {
        const targetId = customerData.id || editingCustomer?.id;
        if (!targetId) {
          throw new Error('ID cliente non disponibile per l\'aggiornamento');
        }
        await apiService.updateClient(targetId, customerData);
      }
      await loadClients();
      setIsCustomerFormOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error saving customer:', error);
    } finally {
      setIsClientsLoading(false);
    }
  };

  const handleNewAppointment = () => {
    setIsModalOpen(false); // Close the client modal
    onNavigateToBooking?.(); // Navigate to booking calendar
  };

  const glassCard = 'bg-white/60 backdrop-blur-xl border border-white/30 shadow-xl';

  return (
    <div className="min-h-screen p-0">
      <div
        className="w-full space-y-6 rounded-3xl p-4 md:p-6"
        style={{
          background: 'var(--theme-page-gradient)',
        }}
      >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Clienti</h1>
          <Button size="lg" onClick={handleNewCustomer}>
            <Plus className="w-5 h-5 mr-2" />
            Nuovo Cliente
          </Button>
        </div>

        {/* Search Bar and Sort */}
        <div className="flex flex-col md:flex-row gap-4">
          <Card className={`flex-1 ${glassCard}`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
              <Input
                type="text"
                placeholder="Cerca per nome o telefono..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>
          <Card className={glassCard}>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'created')}
              options={[
                { value: 'name', label: 'Ordine alfabetico' },
                { value: 'created', label: 'Più recenti' },
              ]}
            />
          </Card>
        </div>

        {/* Clients List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className={`cursor-pointer hover:scale-105 transition-transform ${glassCard}`}
              onClick={() => openClientModal(client)}
            >
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-green-800 rounded-full flex items-center justify-center">
                  <span className="text-yellow-300 font-bold text-lg">
                    {client.first_name[0]}{client.last_name?.[0] || ''}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="text-gray-900 font-semibold text-lg">
                    {client.first_name} {client.last_name || ''}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      {client.phone_e164}
                    </div>
                    {client.email && (
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        {client.email}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Client Detail Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setClientAppointments([]);
          }}
          title="Dettagli Cliente"
        >
          {selectedClient && (
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-2xl">
                    {selectedClient.first_name[0]}{selectedClient.last_name?.[0] || ''}
                  </span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {selectedClient.first_name} {selectedClient.last_name || ''}
                  </h2>
                  {selectedClient.email && (
                    <p className="text-gray-600 flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      {selectedClient.email}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Contatti</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Phone className="w-4 h-4 mr-2" />
                      {selectedClient.phone_e164}
                    </div>
                    {selectedClient.email && (
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 mr-2" />
                        {selectedClient.email}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-gray-900">Statistiche</h3>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Visite totali:</span>
                      <span className="font-semibold">
                        {isLoadingAppointments ? '...' : 
                          clientAppointments.filter(apt => 
                            apt.status !== 'cancelled' && apt.status !== 'no_show'
                          ).length}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Ultimo appuntamento:</span>
                      <span className="font-semibold">
                        {isLoadingAppointments ? '...' : (() => {
                          const completedAppointments = clientAppointments
                            .filter(apt => 
                              apt.status !== 'cancelled' && 
                              apt.status !== 'no_show' &&
                              new Date(apt.start_at) <= new Date()
                            )
                            .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());
                          
                          if (completedAppointments.length > 0) {
                            return formatDate(completedAppointments[0].start_at);
                          }
                          return 'Nessuno';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-900">Storico Visite</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {isLoadingAppointments ? (
                    <div className="text-center py-4 text-gray-500">Caricamento...</div>
                  ) : clientAppointments.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">Nessun appuntamento trovato</div>
                  ) : (
                    clientAppointments
                      .filter(apt => apt.status !== 'cancelled')
                      .sort((a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime())
                      .slice(0, 10)
                      .map((appointment) => (
                        <div key={appointment.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {appointment.services?.name || 'Servizio non specificato'}
                            </div>
                            <div className="text-sm text-gray-600">
                              {formatDate(appointment.start_at)} - {appointment.staff?.full_name || 'Staff non specificato'}
                              {appointment.status === 'completed' && (
                                <span className="ml-2 text-green-600">✓ Completato</span>
                              )}
                              {appointment.status === 'cancelled' && (
                                <span className="ml-2 text-red-600">✗ Cancellato</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <Button variant="primary" className="flex-1" onClick={handleNewAppointment}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Nuovo Appuntamento
                </Button>
                <Button 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => handleEditCustomer(selectedClient)}
                >
                  <User className="w-4 h-4 mr-2" />
                  Modifica Cliente
                </Button>
              </div>
            </div>
          )}
        </Modal>
        
        {/* Customer Form Modal */}
        <CustomerForm
          isOpen={isCustomerFormOpen}
          onClose={() => setIsCustomerFormOpen(false)}
          onSave={handleSaveCustomer}
          customer={editingCustomer}
          mode={customerFormMode}
        />

        {/* Empty State */}
        {filteredClients.length === 0 && searchQuery && (
          <Card className={`text-center py-12 ${glassCard}`}>
            <User className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Nessun cliente trovato</h3>
            <p className="text-gray-600 mb-4">
              Non abbiamo trovato clienti con "{searchQuery}"
            </p>
            <Button onClick={handleNewCustomer}>
              <Plus className="w-4 h-4 mr-2" />
              Crea nuovo cliente
            </Button>
          </Card>
        )}
      </div>
      </div>
    </div>
  );
};