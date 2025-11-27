// Email Notification Service per Resend
// Servizio per inviare notifiche email quando un nuovo cliente si registra o annulla un appuntamento

export interface NewClientNotificationData {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  registrationDate: string;
  shopName: string;
}

export interface AppointmentCancellationData {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  barberName: string;
  shopName: string;
  cancellationReason?: string;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailNotificationService {
  private apiKey: string;
  private isConfigured: boolean = false;

  constructor() {
    this.apiKey = import.meta.env.VITE_RESEND_API_KEY || '';
    this.isConfigured = Boolean(this.apiKey);
    
    if (!this.isConfigured) {
      console.warn('⚠️ Resend API key non configurata. Le email non verranno inviate.');
    }
  }

  // Genera il template HTML per l'email di notifica nuova registrazione
  private generateNewClientNotificationHTML(data: NewClientNotificationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuova Registrazione Cliente - ${data.shopName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background-color: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #10b981;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #10b981;
            margin-bottom: 10px;
          }
          .title {
            font-size: 20px;
            color: #1f2937;
            margin: 0;
          }
          .client-details {
            background-color: #f3f4f6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #374151;
          }
          .detail-value {
            color: #1f2937;
          }
          .highlight {
            background-color: #fef3c7;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .cta-button {
            display: inline-block;
            background-color: #10b981;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            font-weight: 600;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">✂️ ${data.shopName}</div>
            <h1 class="title">Nuovo Cliente Registrato</h1>
          </div>
          
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Un nuovo cliente si è appena registrato nel tuo sistema di gestione!
          </p>
          
          <div class="client-details">
            <div class="detail-row">
              <span class="detail-label">Nome Cliente:</span>
              <span class="detail-value"><span class="highlight">${data.clientName}</span></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${data.clientEmail}</span>
            </div>
            ${data.clientPhone ? `
            <div class="detail-row">
              <span class="detail-label">Telefono:</span>
              <span class="detail-value">${data.clientPhone}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Data Registrazione:</span>
              <span class="detail-value">${data.registrationDate}</span>
            </div>
          </div>

          <div style="text-align: center;">
            <a href="#" class="cta-button">Visualizza Profilo Cliente</a>
          </div>

          <div class="footer">
            <p>Questa email è stata generata automaticamente dal sistema di gestione.</p>
            <p>${data.shopName} - Sistema di Gestione Clienti</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Genera il testo semplice per l'email
  private generateNewClientNotificationText(data: NewClientNotificationData): string {
    return `
NUOVO CLIENTE REGISTRATO - ${data.shopName.toUpperCase()}

Un nuovo cliente si è appena registrato nel tuo sistema di gestione!

Dettagli Cliente:
================

Nome: ${data.clientName}
Email: ${data.clientEmail}
${data.clientPhone ? `Telefono: ${data.clientPhone}` : ''}
Data Registrazione: ${data.registrationDate}

---
Questa email è stata generata automaticamente dal sistema di gestione.
${data.shopName} - Sistema di Gestione Clienti
    `.trim();
  }

  // Genera il template HTML per l'email di annullamento appuntamento
  private generateCancellationNotificationHTML(data: AppointmentCancellationData): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Appuntamento Annullato - ${data.shopName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
          }
          .container {
            background-color: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #ef4444;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #ef4444;
            margin-bottom: 10px;
          }
          .title {
            font-size: 20px;
            color: #1f2937;
            margin: 0;
          }
          .alert-box {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            border-left: 4px solid #ef4444;
            border-radius: 8px;
            padding: 15px 20px;
            margin: 20px 0;
          }
          .alert-icon {
            font-size: 24px;
            margin-right: 10px;
          }
          .appointment-details {
            background-color: #f3f4f6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #374151;
          }
          .detail-value {
            color: #1f2937;
          }
          .cancelled {
            background-color: #fef2f2;
            color: #dc2626;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            text-decoration: line-through;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">✂️ ${data.shopName}</div>
            <h1 class="title">Appuntamento Annullato</h1>
          </div>
          
          <div class="alert-box">
            <span class="alert-icon">⚠️</span>
            <strong>Un cliente ha annullato il suo appuntamento</strong>
          </div>
          
          <div class="appointment-details">
            <div class="detail-row">
              <span class="detail-label">Cliente:</span>
              <span class="detail-value"><strong>${data.clientName}</strong></span>
            </div>
            ${data.clientEmail ? `
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${data.clientEmail}</span>
            </div>
            ` : ''}
            ${data.clientPhone ? `
            <div class="detail-row">
              <span class="detail-label">Telefono:</span>
              <span class="detail-value">${data.clientPhone}</span>
            </div>
            ` : ''}
            <div class="detail-row">
              <span class="detail-label">Servizio:</span>
              <span class="detail-value"><span class="cancelled">${data.serviceName}</span></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Data:</span>
              <span class="detail-value"><span class="cancelled">${data.appointmentDate}</span></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Orario:</span>
              <span class="detail-value"><span class="cancelled">${data.appointmentTime}</span></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Barbiere:</span>
              <span class="detail-value">${data.barberName}</span>
            </div>
          </div>

          <p style="font-size: 14px; color: #6b7280; text-align: center;">
            Lo slot orario è ora nuovamente disponibile per altre prenotazioni.
          </p>

          <div class="footer">
            <p>Questa email è stata generata automaticamente dal sistema di gestione.</p>
            <p>${data.shopName} - Sistema di Gestione Appuntamenti</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Genera il testo semplice per l'email di annullamento
  private generateCancellationNotificationText(data: AppointmentCancellationData): string {
    return `
APPUNTAMENTO ANNULLATO - ${data.shopName.toUpperCase()}

⚠️ Un cliente ha annullato il suo appuntamento!

Dettagli Appuntamento Annullato:
================================

Cliente: ${data.clientName}
${data.clientEmail ? `Email: ${data.clientEmail}` : ''}
${data.clientPhone ? `Telefono: ${data.clientPhone}` : ''}
Servizio: ${data.serviceName}
Data: ${data.appointmentDate}
Orario: ${data.appointmentTime}
Barbiere: ${data.barberName}

Lo slot orario è ora nuovamente disponibile per altre prenotazioni.

---
Questa email è stata generata automaticamente dal sistema di gestione.
${data.shopName} - Sistema di Gestione Appuntamenti
    `.trim();
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
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: 'noreply@resend.dev',
          to: [shopEmail],
          subject: `Nuovo Cliente Registrato - ${clientData.clientName}`,
          html: this.generateNewClientNotificationHTML(clientData),
          text: this.generateNewClientNotificationText(clientData),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Resend API error: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Email notifica nuovo cliente inviata:', result);
      
      return { 
        success: true, 
        messageId: result.id 
      };

    } catch (error) {
      console.error('❌ Errore nell\'invio email notifica:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore sconosciuto' 
      };
    }
  }

  // Invia notifica per appuntamento annullato
  async sendCancellationNotification(
    cancellationData: AppointmentCancellationData, 
    barberEmail: string
  ): Promise<EmailResponse> {
    if (!this.isConfigured) {
      console.log('📧 [MOCK] Email notifica annullamento appuntamento:', {
        to: barberEmail,
        subject: `Appuntamento Annullato - ${cancellationData.clientName}`,
        cancellationData,
        timestamp: new Date().toISOString()
      });
      return { success: true, messageId: 'mock-message-id' };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          from: 'noreply@resend.dev',
          to: [barberEmail],
          subject: `⚠️ Appuntamento Annullato - ${cancellationData.clientName} - ${cancellationData.appointmentDate}`,
          html: this.generateCancellationNotificationHTML(cancellationData),
          text: this.generateCancellationNotificationText(cancellationData),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Resend API error: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Email notifica annullamento inviata:', result);
      
      return { 
        success: true, 
        messageId: result.id 
      };

    } catch (error) {
      console.error('❌ Errore nell\'invio email notifica annullamento:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore sconosciuto' 
      };
    }
  }

  // Testa la configurazione del servizio
  async testConfiguration(): Promise<boolean> {
    if (!this.isConfigured) {
      console.log('📧 [MOCK] Test configurazione email completato');
      return true;
    }

    try {
      // Test semplice chiamando l'API di Resend
      const response = await fetch('https://api.resend.com/domains', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (response.ok) {
        console.log('✅ Configurazione Resend verificata');
        return true;
      } else {
        console.error('❌ Configurazione Resend non valida');
        return false;
      }
    } catch (error) {
      console.error('❌ Errore nel test configurazione:', error);
      return false;
    }
  }

  // Verifica se il servizio è configurato
  isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

export const emailNotificationService = new EmailNotificationService();
