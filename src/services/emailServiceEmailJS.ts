// Email Service per EmailJS - Alternativa a Resend per evitare problemi CORS
// EmailJS è gratuito fino a 200 email/mese e funziona dal browser

export interface NewClientNotificationData {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  registrationDate: string;
  shopName: string;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailJSService {
  private serviceId: string;
  private templateId: string;
  private publicKey: string;
  private isConfigured: boolean = false;

  constructor() {
    // Configurazione EmailJS - da aggiornare con i tuoi valori
    this.serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
    this.templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
    this.publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';
    
    this.isConfigured = Boolean(this.serviceId && this.templateId && this.publicKey);
    
    if (!this.isConfigured) {
      console.warn('⚠️ EmailJS non configurato. Le email non verranno inviate.');
    }
  }

  // Invia notifica per nuovo cliente registrato
  async sendNewClientNotification(
    clientData: NewClientNotificationData, 
    shopEmail: string
  ): Promise<EmailResponse> {
    if (!this.isConfigured) {
      console.log('📧 [MOCK] Email notifica nuovo cliente:', {
        to: shopEmail,
        subject: `Nuovo Cliente Registrato - ${clientData.clientName}`,
        clientData,
        timestamp: new Date().toISOString()
      });
      return { success: true, messageId: 'mock-message-id' };
    }

    try {
      // Carica EmailJS dinamicamente
      const emailjs = await this.loadEmailJS();
      
      const templateParams = {
        to_email: shopEmail,
        client_name: clientData.clientName,
        client_email: clientData.clientEmail,
        client_phone: clientData.clientPhone || 'Non fornito',
        registration_date: clientData.registrationDate,
        shop_name: clientData.shopName,
        from_name: 'Sistema Poltrona'
      };

      const result = await emailjs.send(
        this.serviceId,
        this.templateId,
        templateParams,
        this.publicKey
      );

      console.log('✅ Email notifica nuovo cliente inviata via EmailJS:', result);
      
      return { 
        success: true, 
        messageId: result.text 
      };

    } catch (error) {
      console.error('❌ Errore nell\'invio email notifica via EmailJS:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore sconosciuto' 
      };
    }
  }

  // Carica EmailJS dinamicamente
  private async loadEmailJS(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as any).emailjs) {
        resolve((window as any).emailjs);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
      script.onload = () => {
        (window as any).emailjs.init(this.publicKey);
        resolve((window as any).emailjs);
      };
      script.onerror = () => reject(new Error('Failed to load EmailJS'));
      document.head.appendChild(script);
    });
  }

  // Testa la configurazione del servizio
  async testConfiguration(): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('📧 [MOCK] Test configurazione EmailJS completato');
      return true;
    }

    try {
      const emailjs = await this.loadEmailJS();
      console.log('✅ Configurazione EmailJS verificata');
      return true;
    } catch (error) {
      console.error('❌ Configurazione EmailJS non valida:', error);
      return false;
    }
  }

  // Verifica se il servizio è configurato
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

export const emailJSService = new EmailJSService();
