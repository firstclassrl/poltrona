import { useState, useEffect } from 'react';
import { Search, Phone, Mail, User, Plus, Calendar } from 'lucide-react';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { CustomerForm } from './CustomerForm';
import { apiService } from '../services/api';
import type { Client } from '../types';

interface ClientsProps {
  onNavigateToBooking?: () => void;
}

export const Clients = ({ onNavigateToBooking }: ClientsProps) => {
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => {
    const load = async () => {
      const results = await apiService.searchClients('');
      setClients(results);
    };
    load();
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredClients, setFilteredClients] = useState<Client[]>(clients);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [customerFormMode, setCustomerFormMode] = useState<'add' | 'edit'>('add');
  const [editingCustomer, setEditingCustomer] = useState<Client | null>(null);
  const [, setIsLoading] = useState(false);

  useEffect(() => {
    // Filter clients based on search query
    const filtered = clients.filter(client => 
      client.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.last_name && client.last_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      client.phone_e164.includes(searchQuery)
    );
    setFilteredClients(filtered);
  }, [searchQuery, clients]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 2) {
      setIsLoading(true);
      try {
        const results = await apiService.searchClients(query);
        setFilteredClients(results);
      } catch (error) {
        console.error('Search failed:', error);
        // Fallback to local filtering
      } finally {
        setIsLoading(false);
      }
    }
  };

  const openClientModal = (client: Client) => {
    setSelectedClient(client);
    setIsModalOpen(true);
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
      if (customerFormMode === 'add') {
        // Add new customer logic here
        console.log('Adding new customer:', customerData);
        // In a real app, you would call an API to create the customer
        // const newClient = await apiService.createClient(customerData);
        // setClients(prev => [...prev, newClient]);
      } else {
        // Edit existing customer logic here
        console.log('Editing customer:', customerData);
        // In a real app, you would call an API to update the customer
        // const updatedClient = await apiService.updateClient(customerData);
        // setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
      }
      setIsCustomerFormOpen(false);
    } catch (error) {
      console.error('Error saving customer:', error);
    }
  };

  const handleNewAppointment = () => {
    setIsModalOpen(false); // Close the client modal
    onNavigateToBooking?.(); // Navigate to booking calendar
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Clienti</h1>
        <Button size="lg" onClick={handleNewCustomer}>
          <Plus className="w-5 h-5 mr-2" />
          Nuovo Cliente
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
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

      {/* Clients List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredClients.map((client) => (
          <Card
            key={client.id}
            className="cursor-pointer hover:scale-105 transition-transform"
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
        onClose={() => setIsModalOpen(false)}
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
                    <span className="font-semibold">12</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Ultimo appuntamento:</span>
                    <span className="font-semibold">15/12/2024</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-gray-900">Storico Visite</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {/* Mock history data */}
                {[
                  { date: '2024-12-15', service: 'Taglio + Barba', staff: 'Giovanni' },
                  { date: '2024-11-20', service: 'Taglio Capelli', staff: 'Alessandro' },
                  { date: '2024-10-25', service: 'Taglio + Barba', staff: 'Giovanni' },
                ].map((visit, index) => (
                  <div key={index} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{visit.service}</div>
                      <div className="text-sm text-gray-600">{visit.date} - {visit.staff}</div>
                    </div>
                  </div>
                ))}
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
        <Card className="text-center py-12">
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
  );
};