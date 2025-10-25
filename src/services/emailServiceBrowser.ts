// Email Service Mock per Browser - Retro Barbershop
// Versione browser-compatibile del servizio email

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

class EmailServiceBrowser {
  private isConfigured: boolean = false;

  constructor() {
    this.initializeService();
  }

  private async initializeService() {
    try {
      // Nel browser, usiamo sempre la modalità mock
      this.isConfigured = false;
      console.log('📧 Email Service: Modalità browser (mock) attivata');
    } catch (error) {
      console.error('❌ Errore nell\'inizializzazione email service:', error);
      this.isConfigured = false;
    }
  }

  // Genera il template HTML per l'email di prenotazione
  private generateAppointmentEmailHTML(data: AppointmentEmailData): string {
    const productsList = data.products.length > 0 
      ? data.products.map(p => `<li>${p.name} (x${p.quantity}) - €${p.price.toFixed(2)}</li>`).join('')
      : '<li>Nessun prodotto selezionato</li>';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nuova Prenotazione - Retro Barbershop</title>
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
          .products-section {
            margin-top: 20px;
          }
          .products-list {
            list-style: none;
            padding: 0;
            margin: 10px 0;
          }
          .products-list li {
            padding: 5px 0;
            color: #4b5563;
          }
          .total-price {
            font-size: 18px;
            font-weight: bold;
            color: #10b981;
            text-align: right;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #10b981;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
          .highlight {
            background-color: #fef3c7;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">✂️ Retro Barbershop</div>
            <h1 class="title">Nuova Prenotazione Ricevuta</h1>
          </div>
          
          <div class="appointment-details">
            <div class="detail-row">
              <span class="detail-label">Cliente:</span>
              <span class="detail-value">${data.clientName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Email Cliente:</span>
              <span class="detail-value">${data.clientEmail}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Telefono Cliente:</span>
              <span class="detail-value">${data.clientPhone}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Barbiere:</span>
              <span class="detail-value">${data.barberName}</span>
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
              <span class="detail-label">Servizio:</span>
              <span class="detail-value">${data.serviceName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Prezzo Servizio:</span>
              <span class="detail-value">€${data.servicePrice.toFixed(2)}</span>
            </div>
            ${data.notes ? `
            <div class="detail-row">
              <span class="detail-label">Note:</span>
              <span class="detail-value">${data.notes}</span>
            </div>
            ` : ''}
          </div>

          <div class="products-section">
            <h3 style="color: #374151; margin-bottom: 10px;">Prodotti Prenotati:</h3>
            <ul class="products-list">
              ${productsList}
            </ul>
          </div>

          <div class="total-price">
            Totale: €${data.totalPrice.toFixed(2)}
          </div>

          <div class="footer">
            <p>Questa email è stata generata automaticamente dal sistema di prenotazioni.</p>
            <p>Retro Barbershop - Sistema di Gestione Prenotazioni</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Genera il testo semplice per l'email
  private generateAppointmentEmailText(data: AppointmentEmailData): string {
    const productsList = data.products.length > 0 
      ? data.products.map(p => `- ${p.name} (x${p.quantity}) - €${p.price.toFixed(2)}`).join('\n')
      : '- Nessun prodotto selezionato';

    return `
NUOVA PRENOTAZIONE - RETRO BARBERSHOP

Dettagli Appuntamento:
=====================

Cliente: ${data.clientName}
Email Cliente: ${data.clientEmail}
Telefono Cliente: ${data.clientPhone}
Barbiere: ${data.barberName}
Data: ${data.appointmentDate}
Orario: ${data.appointmentTime}
Servizio: ${data.serviceName}
Prezzo Servizio: €${data.servicePrice.toFixed(2)}

Prodotti Prenotati:
${productsList}

${data.notes ? `Note: ${data.notes}\n` : ''}
Totale: €${data.totalPrice.toFixed(2)}

---
Questa email è stata generata automaticamente dal sistema di prenotazioni.
Retro Barbershop - Sistema di Gestione Prenotazioni
    `.trim();
  }

  // Invia email di notifica prenotazione (modalità mock per browser)
  async sendAppointmentNotification(data: AppointmentEmailData): Promise<boolean> {
    try {
      // Modalità mock per browser - simula l'invio
      console.log('📧 [BROWSER MOCK] Email inviata al barbiere:', {
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
      
      // In un'app reale, qui potresti:
      // 1. Salvare l'email nel localStorage per debug
      // 2. Mostrare una notifica all'utente
      // 3. Inviare una richiesta al backend per l'invio reale
      
      return true;
    } catch (error) {
      console.error('❌ Errore nell\'invio email (mock):', error);
      return false;
    }
  }

  // Invia email di conferma al cliente (modalità mock per browser)
  async sendClientConfirmation(data: AppointmentEmailData): Promise<boolean> {
    try {
      // Modalità mock per browser - simula l'invio
      console.log('📧 [BROWSER MOCK] Email di conferma inviata al cliente:', {
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
      console.error('❌ Errore nell\'invio email di conferma (mock):', error);
      return false;
    }
  }

  // Metodo per testare la configurazione (sempre mock nel browser)
  async testEmailConfiguration(): Promise<boolean> {
    console.log('📧 [BROWSER MOCK] Test configurazione email completato con successo');
    return true;
  }
}

export const emailService = new EmailServiceBrowser();





