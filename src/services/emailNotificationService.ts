// Email Notification Service con RESEND tramite Supabase Edge Function
// Servizio per inviare notifiche email tramite Supabase Edge Function che chiama Resend API
// La Edge Function agisce da proxy server-side per evitare problemi CORS

import { API_CONFIG } from '../config/api';

export interface NewClientNotificationData {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  registrationDate: string;
  shopName: string;
}

export interface ClientWelcomeEmailData {
  clientName: string;
  clientEmail: string;
  shopName: string;
  portalUrl?: string;
  supportEmail?: string;
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

export interface NewAppointmentNotificationData {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  barberName: string;
  shopName: string;
}

export interface EmailConfirmationData {
  clientName: string;
  clientEmail: string;
  confirmationUrl: string;
  shopName: string;
  supportEmail?: string;
}

export interface PasswordResetData {
  clientName: string;
  clientEmail: string;
  resetUrl: string;
  shopName: string;
  supportEmail?: string;
  expirationHours?: number;
}

export interface EmailConfirmationData {
  clientName: string;
  clientEmail: string;
  confirmationUrl: string;
  shopName: string;
  supportEmail?: string;
}

export interface PasswordResetData {
  clientName: string;
  clientEmail: string;
  resetUrl: string;
  shopName: string;
  supportEmail?: string;
  expirationHours?: number;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

class EmailNotificationService {
  private isConfigured: boolean = false;
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor() {
    this.supabaseUrl = API_CONFIG.SUPABASE_EDGE_URL || '';
    this.supabaseKey = API_CONFIG.SUPABASE_ANON_KEY || '';
    this.isConfigured = Boolean(this.supabaseUrl && this.supabaseKey);
  }

  private ensureConfigured(): void {
    if (!this.isConfigured) {
      throw new Error('Servizio email non configurato. Imposta SUPABASE_EDGE_URL e SUPABASE_ANON_KEY.');
    }
  }

  // Metodo per inviare email tramite Supabase Edge Function (che chiama Resend API server-side)
  private async sendEmailViaResend(emailData: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<EmailResponse> {
    try {
      // Validazione dati prima di inviare
      if (!emailData.to || emailData.to.trim() === '') {
        console.error('❌ Campo "to" mancante o vuoto:', emailData.to);
        return { 
          success: false, 
          error: 'Campo "to" mancante o vuoto' 
        };
      }
      
      if (!emailData.subject || emailData.subject.trim() === '') {
        console.error('❌ Campo "subject" mancante o vuoto:', emailData.subject);
        return { 
          success: false, 
          error: 'Campo "subject" mancante o vuoto' 
        };
      }
      
      if ((!emailData.html || emailData.html.trim() === '') && (!emailData.text || emailData.text.trim() === '')) {
        console.error('❌ Campi "html" e "text" entrambi mancanti o vuoti');
        return { 
          success: false, 
          error: 'Almeno uno tra "html" o "text" deve essere fornito' 
        };
      }

      // Costruisci l'URL della Edge Function
      // L'URL base è nel formato: https://xxx.supabase.co
      // La Edge Function sarà: https://xxx.supabase.co/functions/v1/send-email
      const baseUrl = this.supabaseUrl.replace('/rest/v1', '');
      const edgeFunctionUrl = `${baseUrl}/functions/v1/send-email`;

      const payload = {
        to: emailData.to.trim(),
        subject: emailData.subject.trim(),
        html: (emailData.html || '').trim(),
        text: (emailData.text || '').trim(),
      };


      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabaseKey}`,
          'apikey': this.supabaseKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorData: any = {};
        let errorText = '';
        try {
          errorText = await response.text();
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || response.statusText };
        }
        
        const errorMessage = errorData.error || errorData.message || errorText || response.statusText;
        console.error('❌ Edge Function Error:', {
          status: response.status,
          statusText: response.statusText,
          url: edgeFunctionUrl,
          errorData,
          errorText
        });
        
        return { 
          success: false, 
          error: `Edge Function error (${response.status}): ${errorMessage}` 
        };
      }

      const result = await response.json();
      
      return { 
        success: true, 
        messageId: result.id || `resend-${Date.now()}` 
      };

    } catch (error) {
      console.error('❌ Errore invio email via Edge Function:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Errore sconosciuto' 
      };
    }
  }

  // Rimuove gli spazi nelle righe vuote per evitare artefatti (=20) nelle email
  private cleanHtml(html: string): string {
    return html
      .replace(/[ \t]+$/gm, '') // remove trailing spaces that become =20
      .replace(/^\s*$/gm, '');  // remove empty whitespace-only lines
  }

  // Genera il template HTML per l'email di notifica nuova registrazione
  private generateNewClientNotificationHTML(data: NewClientNotificationData): string {
    return this.cleanHtml(`
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
    `);
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
    return this.cleanHtml(`
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
    `);
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
    try {
      this.ensureConfigured();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Servizio email non configurato' 
      };
    }

    return this.sendEmailViaResend({
      to: shopEmail,
      subject: `Nuovo Cliente Registrato - ${clientData.clientName}`,
      html: this.generateNewClientNotificationHTML(clientData),
      text: this.generateNewClientNotificationText(clientData),
    });
  }

  private generateClientWelcomeEmailHTML(data: ClientWelcomeEmailData): string {
    return this.cleanHtml(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Benvenuto in ${data.shopName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f9fafb;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 560px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
            overflow: hidden;
            border: 1px solid #e5e7eb;
          }
          .hero {
            background: linear-gradient(135deg, #10b981, #059669);
            color: #ffffff;
            text-align: center;
            padding: 32px 24px;
          }
          .hero h1 {
            margin: 0;
            font-size: 26px;
          }
          .content {
            padding: 32px;
          }
          .cta {
            display: inline-block;
            margin: 24px 0;
            padding: 14px 28px;
            background-color: #10b981;
            color: #ffffff;
            text-decoration: none;
            border-radius: 999px;
            font-weight: 600;
          }
          .support {
            margin-top: 24px;
            padding: 16px;
            background-color: #ecfdf5;
            border-radius: 12px;
            font-size: 14px;
            color: #065f46;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            padding: 16px 32px 24px;
            background-color: #f9fafb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="hero">
            <p style="margin: 0 0 4px;">${data.shopName}</p>
            <h1>Grazie per esserti iscritto!</h1>
          </div>
          <div class="content">
            <p>Ciao ${data.clientName.split(' ')[0] || data.clientName},</p>
            <p>Siamo entusiasti di averti con noi. Da oggi puoi prenotare con facilità, gestire i tuoi appuntamenti e ricevere aggiornamenti esclusivi dal nostro team.</p>
            <p>Il tuo account è stato creato con successo e puoi accedere in qualsiasi momento per gestire le tue prenotazioni.</p>
            ${data.portalUrl ? `
              <p style="text-align:center;">
                <a class="cta" href="${data.portalUrl}" target="_blank" rel="noopener noreferrer">Accedi ora</a>
              </p>
            ` : ''}
            <p>Se hai domande o hai bisogno di assistenza, siamo sempre qui per aiutarti.</p>
            <div class="support">
              <strong>Serve aiuto?</strong><br />
              Scrivici a ${data.supportEmail || 'info@abruzzo.ai'} e ti risponderemo al più presto.
            </div>
            <p style="margin-top: 28px;">A presto,<br /><strong>Il team ${data.shopName}</strong></p>
          </div>
          <div class="footer">
            Questa email è stata generata automaticamente. Non rispondere a questo messaggio.
          </div>
        </div>
      </body>
      </html>
    `);
  }

  private generateClientWelcomeEmailText(data: ClientWelcomeEmailData): string {
    return `
Benvenuto in ${data.shopName}

Ciao ${data.clientName},

Grazie per esserti iscritto! Il tuo account è stato creato con successo e da ora puoi gestire le tue prenotazioni e ricevere aggiornamenti dal nostro team.
${data.portalUrl ? `Accedi subito: ${data.portalUrl}\n` : ''}
Hai bisogno di supporto? Scrivici a ${data.supportEmail || 'info@abruzzo.ai'} e saremo felici di aiutarti.

A presto,
Il team ${data.shopName}
    `.trim();
  }

  async sendClientWelcomeEmail(
    data: ClientWelcomeEmailData
  ): Promise<EmailResponse> {
    try {
      this.ensureConfigured();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Servizio email non configurato' 
      };
    }

    return this.sendEmailViaResend({
      to: data.clientEmail,
      subject: `Benvenuto in ${data.shopName}!`,
      html: this.generateClientWelcomeEmailHTML(data),
      text: this.generateClientWelcomeEmailText(data),
    });
  }

  // Invia notifica per appuntamento annullato
  async sendCancellationNotification(
    cancellationData: AppointmentCancellationData, 
    shopEmail: string
  ): Promise<EmailResponse> {
    
    try {
      this.ensureConfigured();
    } catch (error) {
      console.error('❌ [EMAIL SERVICE] Servizio non configurato:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Servizio email non configurato' 
      };
    }

    const result = await this.sendEmailViaResend({
      to: shopEmail,
      subject: `⚠️ Appuntamento Annullato - ${cancellationData.clientName} - ${cancellationData.appointmentDate}`,
      html: this.generateCancellationNotificationHTML(cancellationData),
      text: this.generateCancellationNotificationText(cancellationData),
    });
    
    return result;
  }

  // Invia notifica per nuovo appuntamento
  async sendNewAppointmentNotification(
    appointmentData: NewAppointmentNotificationData, 
    shopEmail: string
  ): Promise<EmailResponse> {
    try {
      this.ensureConfigured();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Servizio email non configurato' 
      };
    }

    return this.sendEmailViaResend({
      to: shopEmail,
      subject: `📅 Nuova Prenotazione - ${appointmentData.clientName} - ${appointmentData.appointmentDate} alle ${appointmentData.appointmentTime}`,
      html: this.generateNewAppointmentNotificationHTML(appointmentData),
      text: this.generateNewAppointmentNotificationText(appointmentData),
    });
  }

  async sendRescheduleNotification(
    appointmentData: NewAppointmentNotificationData,
    shopEmail: string
  ): Promise<EmailResponse> {
    try {
      this.ensureConfigured();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Servizio email non configurato' 
      };
    }

    return this.sendEmailViaResend({
      to: shopEmail,
      subject: `🔄 Prenotazione aggiornata - ${appointmentData.clientName} - ${appointmentData.appointmentDate} ${appointmentData.appointmentTime}`,
      html: this.generateNewAppointmentNotificationHTML(appointmentData),
      text: this.generateNewAppointmentNotificationText(appointmentData),
    });
  }

  // Genera HTML per notifica nuovo appuntamento
  private generateNewAppointmentNotificationHTML(data: NewAppointmentNotificationData): string {
    return this.cleanHtml(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { background: #1f2937; color: #9ca3af; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
          .detail-row { display: flex; padding: 12px 0; border-bottom: 1px solid #e5e7eb; }
          .detail-label { font-weight: bold; color: #6b7280; width: 140px; }
          .detail-value { color: #111827; }
          .highlight-box { background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">📅 Nuova Prenotazione!</h1>
          </div>
          <div class="content">
            <div class="highlight-box">
              <strong>Un cliente ha prenotato un appuntamento</strong>
            </div>
            
            <h3 style="color: #10b981; margin-top: 25px;">📋 Dettagli Appuntamento</h3>
            <div class="detail-row">
              <span class="detail-label">Cliente:</span>
              <span class="detail-value">${data.clientName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email:</span>
              <span class="detail-value">${data.clientEmail || 'Non fornita'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Telefono:</span>
              <span class="detail-value">${data.clientPhone || 'Non fornito'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Servizio:</span>
              <span class="detail-value">${data.serviceName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Data:</span>
              <span class="detail-value">${data.appointmentDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Orario:</span>
              <span class="detail-value">${data.appointmentTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Barbiere:</span>
              <span class="detail-value">${data.barberName}</span>
            </div>
          </div>
          <div class="footer">
            <p>${data.shopName} - Sistema di Gestione Prenotazioni</p>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // Genera testo per notifica nuovo appuntamento
  private generateNewAppointmentNotificationText(data: NewAppointmentNotificationData): string {
    return `
📅 NUOVA PRENOTAZIONE

Un cliente ha prenotato un appuntamento.

DETTAGLI APPUNTAMENTO:
- Cliente: ${data.clientName}
- Email: ${data.clientEmail || 'Non fornita'}
- Telefono: ${data.clientPhone || 'Non fornito'}
- Servizio: ${data.serviceName}
- Data: ${data.appointmentDate}
- Orario: ${data.appointmentTime}
- Barbiere: ${data.barberName}

---
${data.shopName} - Sistema di Gestione Prenotazioni
    `.trim();
  }

  // Testa la configurazione del servizio
  async testConfiguration(): Promise<boolean> {
    this.ensureConfigured();

    try {
      // Test la Edge Function di Supabase
      const baseUrl = this.supabaseUrl.replace('/rest/v1', '');
      const edgeFunctionUrl = `${baseUrl}/functions/v1/send-email`;

      const response = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.supabaseKey}`,
          'apikey': this.supabaseKey,
        },
        body: JSON.stringify({ test: true }),
      });

      if (response.ok) {
        return true;
      } else {
        console.error('❌ Configurazione Edge Function non valida');
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

  // Invia email di conferma prenotazione al cliente
  async sendClientAppointmentConfirmation(
    data: NewAppointmentNotificationData
  ): Promise<EmailResponse> {
    try {
      this.ensureConfigured();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Servizio email non configurato' 
      };
    }

    if (!data.clientEmail) {
      return {
        success: false,
        error: 'Email cliente non disponibile'
      };
    }

    return this.sendEmailViaResend({
      to: data.clientEmail,
      subject: `✅ Conferma Prenotazione - ${data.shopName} - ${data.appointmentDate} alle ${data.appointmentTime}`,
      html: this.generateClientAppointmentConfirmationHTML(data),
      text: this.generateClientAppointmentConfirmationText(data),
    });
  }

  // Genera HTML per email di conferma prenotazione al cliente
  private generateClientAppointmentConfirmationHTML(data: NewAppointmentNotificationData): string {
    return this.cleanHtml(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conferma Prenotazione - ${data.shopName}</title>
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
          .success-box {
            background-color: #ecfdf5;
            border: 1px solid #10b981;
            border-left: 4px solid #10b981;
            border-radius: 8px;
            padding: 15px 20px;
            margin: 20px 0;
            text-align: center;
          }
          .success-icon {
            font-size: 32px;
            margin-bottom: 10px;
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
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">✂️ ${data.shopName}</div>
            <h1 class="title">Prenotazione Confermata</h1>
          </div>
          
          <div class="success-box">
            <div class="success-icon">✅</div>
            <strong>La tua prenotazione è stata confermata con successo!</strong>
          </div>
          
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Ciao ${data.clientName.split(' ')[0] || data.clientName},
          </p>
          
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            La tua prenotazione è stata confermata. Ti aspettiamo!
          </p>
          
          <div class="appointment-details">
            <div class="detail-row">
              <span class="detail-label">Servizio:</span>
              <span class="detail-value"><strong>${data.serviceName}</strong></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Data:</span>
              <span class="detail-value"><span class="highlight">${data.appointmentDate}</span></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Orario:</span>
              <span class="detail-value"><span class="highlight">${data.appointmentTime}</span></span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Barbiere:</span>
              <span class="detail-value">${data.barberName}</span>
            </div>
          </div>

          <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 20px;">
            Ti ricordiamo che puoi gestire o annullare la tua prenotazione accedendo al tuo profilo.
          </p>

          <div class="footer">
            <p>Questa email è stata generata automaticamente dal sistema di gestione.</p>
            <p>${data.shopName} - Sistema di Gestione Appuntamenti</p>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // Genera testo per email di conferma prenotazione al cliente
  private generateClientAppointmentConfirmationText(data: NewAppointmentNotificationData): string {
    return `
CONFERMA PRENOTAZIONE - ${data.shopName.toUpperCase()}

✅ La tua prenotazione è stata confermata con successo!

Ciao ${data.clientName.split(' ')[0] || data.clientName},

La tua prenotazione è stata confermata. Ti aspettiamo!

DETTAGLI APPUNTAMENTO:
=====================

Servizio: ${data.serviceName}
Data: ${data.appointmentDate}
Orario: ${data.appointmentTime}
Barbiere: ${data.barberName}

Ti ricordiamo che puoi gestire o annullare la tua prenotazione accedendo al tuo profilo.

---
Questa email è stata generata automaticamente dal sistema di gestione.
${data.shopName} - Sistema di Gestione Appuntamenti
    `.trim();
  }

  // Invia email di annullamento prenotazione al cliente
  async sendClientCancellationEmail(
    data: AppointmentCancellationData
  ): Promise<EmailResponse> {
    
    try {
      this.ensureConfigured();
    } catch (error) {
      console.error('❌ [EMAIL SERVICE] Servizio non configurato:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Servizio email non configurato' 
      };
    }

    if (!data.clientEmail) {
      console.error('❌ [EMAIL SERVICE] Email cliente non disponibile');
      return {
        success: false,
        error: 'Email cliente non disponibile'
      };
    }

    const result = await this.sendEmailViaResend({
      to: data.clientEmail,
      subject: `❌ Appuntamento Annullato - ${data.shopName} - ${data.appointmentDate}`,
      html: this.generateClientCancellationEmailHTML(data),
      text: this.generateClientCancellationEmailText(data),
    });
    
    return result;
  }

  // Genera HTML per email di annullamento al cliente
  private generateClientCancellationEmailHTML(data: AppointmentCancellationData): string {
    return this.cleanHtml(`
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
          .info-box {
            background-color: #fef3c7;
            border: 1px solid #fbbf24;
            border-left: 4px solid #f59e0b;
            border-radius: 8px;
            padding: 15px 20px;
            margin: 20px 0;
            text-align: center;
          }
          .info-icon {
            font-size: 32px;
            margin-bottom: 10px;
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
          
          <div class="info-box">
            <div class="info-icon">ℹ️</div>
            <strong>Il tuo appuntamento è stato annullato</strong>
          </div>
          
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Ciao ${data.clientName.split(' ')[0] || data.clientName},
          </p>
          
          <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
            Ti confermiamo che il tuo appuntamento è stato annullato come richiesto.
          </p>
          
          <div class="appointment-details">
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

          <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 20px;">
            Se desideri prenotare un nuovo appuntamento, puoi farlo accedendo al tuo profilo.
          </p>

          <div class="footer">
            <p>Questa email è stata generata automaticamente dal sistema di gestione.</p>
            <p>${data.shopName} - Sistema di Gestione Appuntamenti</p>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // Genera testo per email di annullamento al cliente
  private generateClientCancellationEmailText(data: AppointmentCancellationData): string {
    return `
APPUNTAMENTO ANNULLATO - ${data.shopName.toUpperCase()}

ℹ️ Il tuo appuntamento è stato annullato

Ciao ${data.clientName.split(' ')[0] || data.clientName},

Ti confermiamo che il tuo appuntamento è stato annullato come richiesto.

DETTAGLI APPUNTAMENTO ANNULLATO:
=================================

Servizio: ${data.serviceName}
Data: ${data.appointmentDate}
Orario: ${data.appointmentTime}
Barbiere: ${data.barberName}

Se desideri prenotare un nuovo appuntamento, puoi farlo accedendo al tuo profilo.

---
Questa email è stata generata automaticamente dal sistema di gestione.
${data.shopName} - Sistema di Gestione Appuntamenti
    `.trim();
  }

  // Genera HTML per email di conferma iscrizione
  private generateEmailConfirmationHTML(data: EmailConfirmationData): string {
    return this.cleanHtml(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Conferma la tua email - ${data.shopName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f9fafb;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
            overflow: hidden;
            border: 1px solid #e5e7eb;
          }
          .hero {
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #ffffff;
            text-align: center;
            padding: 40px 24px;
          }
          .hero-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          .hero h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 32px;
          }
          .welcome-text {
            font-size: 18px;
            color: #374151;
            margin-bottom: 24px;
            line-height: 1.8;
          }
          .confirmation-box {
            background: linear-gradient(135deg, #eff6ff, #dbeafe);
            border: 2px solid #3b82f6;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
          }
          .confirmation-box p {
            margin: 0 0 20px 0;
            font-size: 16px;
            color: #1e40af;
            font-weight: 600;
          }
          .cta-button {
            display: inline-block;
            padding: 16px 32px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
            transition: transform 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(59, 130, 246, 0.4);
          }
          .info-box {
            background-color: #f3f4f6;
            border-left: 4px solid #6b7280;
            border-radius: 8px;
            padding: 16px 20px;
            margin: 24px 0;
            font-size: 14px;
            color: #4b5563;
          }
          .info-box strong {
            color: #1f2937;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            padding: 24px 32px;
            background-color: #f9fafb;
            border-top: 1px solid #e5e7eb;
          }
          .footer-link {
            color: #3b82f6;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="hero">
            <div class="hero-icon">✉️</div>
            <h1>Conferma la tua email</h1>
          </div>
          <div class="content">
            <p class="welcome-text">
              Ciao <strong>${data.clientName.split(' ')[0] || data.clientName}</strong>,
            </p>
            <p class="welcome-text">
              Grazie per esserti registrato su <strong>${data.shopName}</strong>! Per completare la registrazione e attivare il tuo account, ti chiediamo di confermare il tuo indirizzo email.
            </p>
            
            <div class="confirmation-box">
              <p>Conferma il tuo indirizzo email cliccando sul pulsante qui sotto:</p>
              <a href="${data.confirmationUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
                Conferma Email
              </a>
            </div>

            <div class="info-box">
              <strong>💡 Non riesci a cliccare il pulsante?</strong><br />
              Copia e incolla questo link nel tuo browser:<br />
              <a href="${data.confirmationUrl}" style="color: #3b82f6; word-break: break-all;">${data.confirmationUrl}</a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
              Se non hai richiesto questa registrazione, puoi ignorare questa email. Il tuo account non verrà creato finché non confermi l'indirizzo email.
            </p>

            <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
              Il link di conferma scade dopo 24 ore per motivi di sicurezza.
            </p>

            ${data.supportEmail ? `
            <div class="info-box" style="margin-top: 32px;">
              <strong>Hai bisogno di aiuto?</strong><br />
              Contattaci all'indirizzo <a href="mailto:${data.supportEmail}" class="footer-link">${data.supportEmail}</a> e saremo felici di aiutarti.
            </div>
            ` : ''}

            <p style="margin-top: 32px; color: #374151;">
              A presto,<br />
              <strong>Il team di ${data.shopName}</strong>
            </p>
          </div>
          <div class="footer">
            <p>Questa email è stata inviata a ${data.clientEmail}</p>
            <p>Se non hai richiesto questa registrazione, ignora questa email.</p>
            <p style="margin-top: 12px;">
              © ${new Date().getFullYear()} ${data.shopName} - Tutti i diritti riservati
            </p>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // Genera testo semplice per email di conferma iscrizione
  private generateEmailConfirmationText(data: EmailConfirmationData): string {
    return `
CONFERMA LA TUA EMAIL - ${data.shopName.toUpperCase()}

Ciao ${data.clientName.split(' ')[0] || data.clientName},

Grazie per esserti registrato su ${data.shopName}!

Per completare la registrazione e attivare il tuo account, ti chiediamo di confermare il tuo indirizzo email cliccando sul link qui sotto:

${data.confirmationUrl}

Se non riesci a cliccare il link, copia e incolla l'URL sopra nel tuo browser.

IMPORTANTE:
- Il link di conferma scade dopo 24 ore per motivi di sicurezza
- Se non hai richiesto questa registrazione, puoi ignorare questa email
- Il tuo account non verrà creato finché non confermi l'indirizzo email

${data.supportEmail ? `Hai bisogno di aiuto? Contattaci all'indirizzo ${data.supportEmail}` : ''}

A presto,
Il team di ${data.shopName}

---
Questa email è stata inviata a ${data.clientEmail}
Se non hai richiesto questa registrazione, ignora questa email.
© ${new Date().getFullYear()} ${data.shopName} - Tutti i diritti riservati
    `.trim();
  }

  // Genera HTML per email di reset password
  private generatePasswordResetHTML(data: PasswordResetData): string {
    const expirationText = data.expirationHours 
      ? `Il link scade tra ${data.expirationHours} ${data.expirationHours === 1 ? 'ora' : 'ore'} per motivi di sicurezza.`
      : 'Il link scade dopo 1 ora per motivi di sicurezza.';
    
    return this.cleanHtml(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reimposta la tua password - ${data.shopName}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #f9fafb;
            margin: 0;
            padding: 20px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 25px rgba(15, 23, 42, 0.1);
            overflow: hidden;
            border: 1px solid #e5e7eb;
          }
          .hero {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #ffffff;
            text-align: center;
            padding: 40px 24px;
          }
          .hero-icon {
            font-size: 48px;
            margin-bottom: 16px;
          }
          .hero h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .content {
            padding: 40px 32px;
          }
          .welcome-text {
            font-size: 18px;
            color: #374151;
            margin-bottom: 24px;
            line-height: 1.8;
          }
          .reset-box {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border: 2px solid #f59e0b;
            border-radius: 12px;
            padding: 24px;
            margin: 32px 0;
            text-align: center;
          }
          .reset-box p {
            margin: 0 0 20px 0;
            font-size: 16px;
            color: #92400e;
            font-weight: 600;
          }
          .cta-button {
            display: inline-block;
            padding: 16px 32px;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(245, 158, 11, 0.3);
            transition: transform 0.2s;
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 12px rgba(245, 158, 11, 0.4);
          }
          .warning-box {
            background-color: #fef2f2;
            border-left: 4px solid #ef4444;
            border-radius: 8px;
            padding: 16px 20px;
            margin: 24px 0;
            font-size: 14px;
            color: #991b1b;
          }
          .warning-box strong {
            color: #dc2626;
          }
          .info-box {
            background-color: #f3f4f6;
            border-left: 4px solid #6b7280;
            border-radius: 8px;
            padding: 16px 20px;
            margin: 24px 0;
            font-size: 14px;
            color: #4b5563;
          }
          .info-box strong {
            color: #1f2937;
          }
          .footer {
            text-align: center;
            font-size: 12px;
            color: #9ca3af;
            padding: 24px 32px;
            background-color: #f9fafb;
            border-top: 1px solid #e5e7eb;
          }
          .footer-link {
            color: #f59e0b;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="hero">
            <div class="hero-icon">🔐</div>
            <h1>Reimposta la tua password</h1>
          </div>
          <div class="content">
            <p class="welcome-text">
              Ciao <strong>${data.clientName.split(' ')[0] || data.clientName}</strong>,
            </p>
            <p class="welcome-text">
              Abbiamo ricevuto una richiesta per reimpostare la password del tuo account su <strong>${data.shopName}</strong>. Se hai fatto tu questa richiesta, clicca sul pulsante qui sotto per creare una nuova password.
            </p>
            
            <div class="reset-box">
              <p>Reimposta la tua password cliccando sul pulsante qui sotto:</p>
              <a href="${data.resetUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">
                Reimposta Password
              </a>
            </div>

            <div class="warning-box">
              <strong>⚠️ Attenzione!</strong><br />
              Se non hai richiesto il reset della password, ignora questa email. La tua password attuale rimarrà invariata.
            </div>

            <div class="info-box">
              <strong>💡 Non riesci a cliccare il pulsante?</strong><br />
              Copia e incolla questo link nel tuo browser:<br />
              <a href="${data.resetUrl}" style="color: #f59e0b; word-break: break-all;">${data.resetUrl}</a>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 24px;">
              ${expirationText}
            </p>

            <p style="font-size: 14px; color: #6b7280; margin-top: 16px;">
              Per motivi di sicurezza, questo link può essere utilizzato una sola volta. Se il link è scaduto o hai già reimpostato la password, puoi richiedere un nuovo link dalla pagina di login.
            </p>

            ${data.supportEmail ? `
            <div class="info-box" style="margin-top: 32px;">
              <strong>Hai bisogno di aiuto?</strong><br />
              Se hai problemi o non hai richiesto questo reset, contattaci all'indirizzo <a href="mailto:${data.supportEmail}" class="footer-link">${data.supportEmail}</a> e saremo felici di aiutarti.
            </div>
            ` : ''}

            <p style="margin-top: 32px; color: #374151;">
              A presto,<br />
              <strong>Il team di ${data.shopName}</strong>
            </p>
          </div>
          <div class="footer">
            <p>Questa email è stata inviata a ${data.clientEmail}</p>
            <p>Se non hai richiesto il reset della password, ignora questa email.</p>
            <p style="margin-top: 12px;">
              © ${new Date().getFullYear()} ${data.shopName} - Tutti i diritti riservati
            </p>
          </div>
        </div>
      </body>
      </html>
    `);
  }

  // Genera testo semplice per email di reset password
  private generatePasswordResetText(data: PasswordResetData): string {
    const expirationText = data.expirationHours 
      ? `Il link scade tra ${data.expirationHours} ${data.expirationHours === 1 ? 'ora' : 'ore'} per motivi di sicurezza.`
      : 'Il link scade dopo 1 ora per motivi di sicurezza.';
    
    return `
REIMPOSTA LA TUA PASSWORD - ${data.shopName.toUpperCase()}

Ciao ${data.clientName.split(' ')[0] || data.clientName},

Abbiamo ricevuto una richiesta per reimpostare la password del tuo account su ${data.shopName}.

Se hai fatto tu questa richiesta, clicca sul link qui sotto per creare una nuova password:

${data.resetUrl}

Se non riesci a cliccare il link, copia e incolla l'URL sopra nel tuo browser.

⚠️ ATTENZIONE:
- Se non hai richiesto il reset della password, IGNORA questa email
- La tua password attuale rimarrà invariata se non clicchi sul link
- Questo link può essere utilizzato una sola volta
- ${expirationText}

${data.supportEmail ? `Hai bisogno di aiuto? Contattaci all'indirizzo ${data.supportEmail}` : ''}

A presto,
Il team di ${data.shopName}

---
Questa email è stata inviata a ${data.clientEmail}
Se non hai richiesto il reset della password, ignora questa email.
© ${new Date().getFullYear()} ${data.shopName} - Tutti i diritti riservati
    `.trim();
  }

  // Invia email di conferma iscrizione
  async sendEmailConfirmation(
    data: EmailConfirmationData
  ): Promise<EmailResponse> {
    try {
      this.ensureConfigured();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Servizio email non configurato' 
      };
    }

    return this.sendEmailViaResend({
      to: data.clientEmail,
      subject: `Conferma la tua email - ${data.shopName}`,
      html: this.generateEmailConfirmationHTML(data),
      text: this.generateEmailConfirmationText(data),
    });
  }

  // Invia email di reset password
  async sendPasswordResetEmail(
    data: PasswordResetData
  ): Promise<EmailResponse> {
    try {
      this.ensureConfigured();
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Servizio email non configurato' 
      };
    }

    return this.sendEmailViaResend({
      to: data.clientEmail,
      subject: `Reimposta la tua password - ${data.shopName}`,
      html: this.generatePasswordResetHTML(data),
      text: this.generatePasswordResetText(data),
    });
  }
}

export const emailNotificationService = new EmailNotificationService();
