import { useState, useCallback } from 'react';
import type { ClientRegistrationData, RegisteredClient, PrivacyConsent } from '../types/auth';

export const useClientRegistration = () => {
  const [isLoading, setIsLoading] = useState(false);

  // Genera un ID univoco per il nuovo cliente
  const generateClientId = useCallback((): string => {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Normalizza numero di telefono italiano in formato E.164
  const normalizeItalianPhone = useCallback((phone: string): string => {
    // Rimuovi spazi e caratteri non numerici
    let cleaned = phone.replace(/\s/g, '').replace(/[^0-9+]/g, '');

    // Rimuovi prefissi italiani comuni
    if (cleaned.startsWith('0039')) {
      cleaned = cleaned.substring(4);
    } else if (cleaned.startsWith('+39')) {
      cleaned = cleaned.substring(3);
    } else if (cleaned.startsWith('39')) {
      cleaned = cleaned.substring(2);
    }

    // Aggiungi il prefisso +39
    return `+39${cleaned}`;
  }, []);

  // Valida i dati di registrazione
  const validateRegistrationData = useCallback((data: ClientRegistrationData): string | null => {
    // Validazione consenso privacy
    if (!data.privacyConsent || !data.privacyConsent.accepted) {
      return 'Devi accettare l\'Informativa Privacy per procedere';
    }

    // Validazione password match
    if (data.password !== data.confirmPassword) {
      return 'Le password non coincidono';
    }

    // Validazione password lunghezza minima
    if (data.password.length < 6) {
      return 'La password deve contenere almeno 6 caratteri';
    }

    // Validazione campi obbligatori
    if (!data.firstName || !data.lastName || !data.phone || !data.email || !data.password) {
      return 'Tutti i campi sono obbligatori';
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return 'Formato email non valido';
    }

    // Validazione telefono italiano (10 cifre dopo il prefisso)
    const cleanedPhone = data.phone.replace(/\s/g, '').replace(/[^0-9+]/g, '');
    const phoneRegex = /^(\+39|0039|39)?[0-9]{9,10}$/;
    if (!phoneRegex.test(cleanedPhone)) {
      return 'Formato telefono non valido (es. +39 333 1234567 o 3331234567)';
    }

    return null;
  }, []);

  // Controlla se l'email è già registrata
  const isEmailAlreadyRegistered = useCallback((email: string): boolean => {
    try {
      const registeredClients = localStorage.getItem('registered_clients');
      if (registeredClients) {
        const clients: RegisteredClient[] = JSON.parse(registeredClients);
        return clients.some(client => client.email.toLowerCase() === email.toLowerCase());
      }
      return false;
    } catch (error) {
      console.error('Errore nel controllo email esistente:', error);
      return false;
    }
  }, []);

  // Salva il cliente nel localStorage
  const saveClientToStorage = useCallback((client: RegisteredClient): boolean => {
    try {
      // Carica i clienti esistenti
      const existingClients = localStorage.getItem('registered_clients');
      const clients: RegisteredClient[] = existingClients ? JSON.parse(existingClients) : [];

      // Aggiungi il nuovo cliente
      clients.push(client);

      // Salva la lista aggiornata
      localStorage.setItem('registered_clients', JSON.stringify(clients));

      return true;
    } catch (error) {
      console.error('Errore nel salvataggio del cliente:', error);
      return false;
    }
  }, []);

  // Registra un nuovo cliente
  const registerClient = useCallback(async (data: ClientRegistrationData): Promise<RegisteredClient> => {
    setIsLoading(true);

    try {
      // Validazione dati
      const validationError = validateRegistrationData(data);
      if (validationError) {
        throw new Error(validationError);
      }

      // Controlla se l'email è già registrata
      if (isEmailAlreadyRegistered(data.email)) {
        throw new Error('Email già registrata');
      }

      // Normalizza il telefono in formato E.164
      const normalizedPhone = normalizeItalianPhone(data.phone);

      // Crea il nuovo cliente con consenso privacy
      const newClient: RegisteredClient = {
        id: generateClientId(),
        full_name: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: normalizedPhone,
        role: 'client',
        created_at: new Date().toISOString(),
        privacyConsent: data.privacyConsent
      };

      // Salva il nuovo cliente nel localStorage
      const success = saveClientToStorage(newClient);

      if (!success) {
        throw new Error('Errore nel salvataggio del cliente');
      }

      return newClient;

    } catch (error) {
      console.error('Error registering client:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [validateRegistrationData, isEmailAlreadyRegistered, normalizeItalianPhone, saveClientToStorage, generateClientId]);

  // Ottieni tutti i clienti registrati
  const getRegisteredClients = useCallback((): RegisteredClient[] => {
    try {
      const registeredClients = localStorage.getItem('registered_clients');
      return registeredClients ? JSON.parse(registeredClients) : [];
    } catch (error) {
      console.error('Errore nel caricamento dei clienti registrati:', error);
      return [];
    }
  }, []);

  // Ottieni un cliente per email
  const getClientByEmail = useCallback((email: string): RegisteredClient | null => {
    try {
      // Usa localStorage direttamente per evitare dipendenze circolari
      const registeredClients = localStorage.getItem('registered_clients');
      const clients: RegisteredClient[] = registeredClients ? JSON.parse(registeredClients) : [];
      return clients.find(client => client.email.toLowerCase() === email.toLowerCase()) || null;
    } catch (error) {
      console.error('Errore nel recupero del cliente:', error);
      return null;
    }
  }, []);

  // Elimina un cliente registrato
  const deleteRegisteredClient = useCallback((clientId: string): boolean => {
    try {
      const clients = localStorage.getItem('registered_clients');
      const clientList: RegisteredClient[] = clients ? JSON.parse(clients) : [];
      const updatedClients = clientList.filter(client => client.id !== clientId);
      localStorage.setItem('registered_clients', JSON.stringify(updatedClients));
      return true;
    } catch (error) {
      console.error('Error deleting client:', error);
      return false;
    }
  }, []);

  return {
    isLoading,
    registerClient,
    validateRegistrationData,
    isEmailAlreadyRegistered,
    getRegisteredClients,
    getClientByEmail,
    deleteRegisteredClient,
  };
};
