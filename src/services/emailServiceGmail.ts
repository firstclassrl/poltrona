// Email Service per Gmail - Retro Barbershop
// Configurazione per inviare notifiche via Gmail
// NOTA: Questo servizio è stato disabilitato per il browser
// Usare emailServiceBrowser.ts per il client-side

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface AppointmentEmailData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  barberName: string;
  barberEmail: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceName: string;
  servicePrice: number;
  products: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  totalPrice: number;
  notes?: string;
}

class EmailService {
  private isConfigured: boolean = false;

  constructor() {
    this.initializeService();
  }

  // Metodo per verificare se il servizio è configurato
  public isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  private async initializeService() {
    try {
      // Nel browser, usiamo sempre la modalità mock
      this.isConfigured = false;
      console.log('📧 Email Service Gmail: Modalità browser (mock) attivata');
    } catch (error) {
      console.error('❌ Errore nell\'inizializzazione email service Gmail:', error);
      this.isConfigured = false;
    }
  }

  // Invia email di notifica prenotazione (modalità mock per browser)
  async sendAppointmentNotification(data: AppointmentEmailData): Promise<boolean> {
    try {
      // Modalità mock per browser - simula l'invio
      console.log('📧 [GMAIL MOCK] Email inviata al barbiere:', {
        to: data.barberEmail,
        subject: `Nuova Prenotazione - ${data.clientName} - ${data.appointmentDate} alle ${data.appointmentTime}`,
        timestamp: new Date().toISOString(),
        details: {
          clientName: data.clientName,
          appointmentDate: data.appointmentDate,
          appointmentTime: data.appointmentTime,
          serviceName: data.serviceName,
          totalPrice: data.totalPrice
        }
      });

      // Simula il tempo di invio
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error('❌ Errore nell\'invio email Gmail (mock):', error);
      return false;
    }
  }

  // Invia email di conferma al cliente (modalità mock per browser)
  async sendClientConfirmation(data: AppointmentEmailData): Promise<boolean> {
    try {
      // Modalità mock per browser - simula l'invio
      console.log('📧 [GMAIL MOCK] Email di conferma inviata al cliente:', {
        to: data.clientEmail,
        subject: `Conferma Prenotazione - ${data.appointmentDate} alle ${data.appointmentTime}`,
        timestamp: new Date().toISOString(),
        details: {
          clientName: data.clientName,
          appointmentDate: data.appointmentDate,
          appointmentTime: data.appointmentTime,
          serviceName: data.serviceName,
          totalPrice: data.totalPrice
        }
      });

      // Simula il tempo di invio
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (error) {
      console.error('❌ Errore nell\'invio email di conferma Gmail (mock):', error);
      return false;
    }
  }

  // Metodo per testare la configurazione (sempre mock nel browser)
  async testEmailConfiguration(): Promise<boolean> {
    console.log('📧 [GMAIL MOCK] Test configurazione email Gmail completato con successo');
    return true;
  }
}

export const emailService = new EmailService();