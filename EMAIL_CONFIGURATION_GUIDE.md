# 📧 Guida Configurazione Notifiche Email

## Panoramica
Attualmente il sistema ha un servizio email mock che simula l'invio delle notifiche. Per abilitare l'invio reale delle email, devi configurare un provider email.

## 🎯 Opzioni di Configurazione

### 1. **SendGrid (Raccomandato)**
SendGrid è uno dei servizi email più popolari e affidabili.

#### Setup SendGrid:
1. **Registrati** su [SendGrid](https://sendgrid.com/)
2. **Crea** un API Key:
   - Vai su Settings > API Keys
   - Crea una nuova API Key con permessi "Full Access"
3. **Configura** il dominio (opzionale ma raccomandato)

#### Installazione:
```bash
npm install @sendgrid/mail
```

#### Configurazione:
```typescript
// src/services/emailService.ts
import sgMail from '@sendgrid/mail';

class EmailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY || 'your-api-key-here');
  }

  async sendAppointmentNotification(data: AppointmentEmailData): Promise<boolean> {
    try {
      const msg = {
        to: data.barberEmail,
        from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
        subject: `Nuova Prenotazione - ${data.clientName} - ${data.appointmentDate} alle ${data.appointmentTime}`,
        html: this.generateAppointmentEmailHTML(data),
        text: this.generateAppointmentEmailText(data)
      };

      await sgMail.send(msg);
      console.log('✅ Email inviata con successo via SendGrid');
      return true;
    } catch (error) {
      console.error('❌ Errore SendGrid:', error);
      return false;
    }
  }
}
```

### 2. **Nodemailer con Gmail**
Perfetto per test e piccoli volumi.

#### Installazione:
```bash
npm install nodemailer
npm install @types/nodemailer
```

#### Configurazione:
```typescript
// src/services/emailService.ts
import nodemailer from 'nodemailer';

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || 'your-email@gmail.com',
        pass: process.env.GMAIL_APP_PASSWORD || 'your-app-password'
      }
    });
  }

  async sendAppointmentNotification(data: AppointmentEmailData): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'your-email@gmail.com',
        to: data.barberEmail,
        subject: `Nuova Prenotazione - ${data.clientName} - ${data.appointmentDate} alle ${data.appointmentTime}`,
        html: this.generateAppointmentEmailHTML(data),
        text: this.generateAppointmentEmailText(data)
      };

      await this.transporter.sendMail(mailOptions);
      console.log('✅ Email inviata con successo via Gmail');
      return true;
    } catch (error) {
      console.error('❌ Errore Gmail:', error);
      return false;
    }
  }
}
```

### 3. **Mailgun**
Alternativa robusta a SendGrid.

#### Installazione:
```bash
npm install mailgun-js
```

#### Configurazione:
```typescript
// src/services/emailService.ts
import mailgun from 'mailgun-js';

class EmailService {
  private mg: mailgun.Mailgun;

  constructor() {
    this.mg = mailgun({
      apiKey: process.env.MAILGUN_API_KEY || 'your-api-key',
      domain: process.env.MAILGUN_DOMAIN || 'your-domain.mailgun.org'
    });
  }

  async sendAppointmentNotification(data: AppointmentEmailData): Promise<boolean> {
    try {
      const emailData = {
        from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
        to: data.barberEmail,
        subject: `Nuova Prenotazione - ${data.clientName} - ${data.appointmentDate} alle ${data.appointmentTime}`,
        html: this.generateAppointmentEmailHTML(data),
        text: this.generateAppointmentEmailText(data)
      };

      await this.mg.messages().send(emailData);
      console.log('✅ Email inviata con successo via Mailgun');
      return true;
    } catch (error) {
      console.error('❌ Errore Mailgun:', error);
      return false;
    }
  }
}
```

## 🔧 Configurazione Variabili d'Ambiente

Crea un file `.env` nella root del progetto:

```env
# SendGrid
SENDGRID_API_KEY=your-sendgrid-api-key-here
FROM_EMAIL=noreply@yourdomain.com

# Gmail (alternativa)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password

# Mailgun (alternativa)
MAILGUN_API_KEY=your-mailgun-api-key
MAILGUN_DOMAIN=your-domain.mailgun.org

# Configurazione generale
NODE_ENV=production
```

## 📋 Passaggi per l'Implementazione

### 1. **Scegli il Provider**
- **SendGrid**: Per produzione e volumi alti
- **Gmail**: Per test e piccoli volumi
- **Mailgun**: Alternativa robusta

### 2. **Installa le Dipendenze**
```bash
# Per SendGrid
npm install @sendgrid/mail

# Per Gmail
npm install nodemailer @types/nodemailer

# Per Mailgun
npm install mailgun-js
```

### 3. **Configura le Variabili d'Ambiente**
- Crea il file `.env`
- Aggiungi le credenziali del provider scelto
- Non committare mai il file `.env`!

### 4. **Aggiorna il Servizio Email**
- Sostituisci il codice mock con l'implementazione reale
- Testa l'invio delle email

### 5. **Testa la Configurazione**
- Fai una prenotazione di test
- Verifica che l'email arrivi al barbiere
- Controlla i log per eventuali errori

## 🚀 Implementazione Rapida (SendGrid)

### 1. **Registrati su SendGrid**
- Vai su [sendgrid.com](https://sendgrid.com/)
- Crea un account gratuito (100 email/giorno)

### 2. **Ottieni l'API Key**
- Settings > API Keys > Create API Key
- Nome: "Barbershop App"
- Permissions: "Full Access"
- Copia la chiave generata

### 3. **Installa SendGrid**
```bash
npm install @sendgrid/mail
```

### 4. **Aggiorna il Servizio**
Sostituisci il contenuto di `src/services/emailService.ts` con:

```typescript
import sgMail from '@sendgrid/mail';

// Configura SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || 'your-api-key-here');

class EmailService {
  // ... resto del codice esistente ...

  async sendAppointmentNotification(data: AppointmentEmailData): Promise<boolean> {
    try {
      const msg = {
        to: data.barberEmail,
        from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
        subject: `Nuova Prenotazione - ${data.clientName} - ${data.appointmentDate} alle ${data.appointmentTime}`,
        html: this.generateAppointmentEmailHTML(data),
        text: this.generateAppointmentEmailText(data)
      };

      await sgMail.send(msg);
      console.log('✅ Email inviata con successo via SendGrid');
      return true;
    } catch (error) {
      console.error('❌ Errore SendGrid:', error);
      return false;
    }
  }

  async sendClientConfirmation(data: AppointmentEmailData): Promise<boolean> {
    try {
      const msg = {
        to: data.clientEmail,
        from: process.env.FROM_EMAIL || 'noreply@yourdomain.com',
        subject: `Conferma Prenotazione - ${data.appointmentDate} alle ${data.appointmentTime}`,
        html: this.generateAppointmentEmailHTML(data),
        text: this.generateAppointmentEmailText(data)
      };

      await sgMail.send(msg);
      console.log('✅ Email di conferma inviata via SendGrid');
      return true;
    } catch (error) {
      console.error('❌ Errore SendGrid conferma:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
```

### 5. **Crea il File .env**
```env
SENDGRID_API_KEY=SG.your-actual-api-key-here
FROM_EMAIL=noreply@yourdomain.com
```

### 6. **Testa l'Invio**
- Fai una prenotazione
- Controlla la console per i log
- Verifica che l'email arrivi

## 🔍 Debugging e Troubleshooting

### Problemi Comuni:

1. **"Invalid API Key"**
   - Verifica che l'API Key sia corretta
   - Controlla che abbia i permessi necessari

2. **"From email not verified"**
   - Verifica il dominio su SendGrid
   - Usa un email verificato

3. **Email non arrivano**
   - Controlla la cartella spam
   - Verifica i log di SendGrid
   - Testa con email diverse

### Log di Debug:
```typescript
// Aggiungi questo per debug
console.log('📧 Tentativo invio email:', {
  to: data.barberEmail,
  from: process.env.FROM_EMAIL,
  subject: msg.subject,
  timestamp: new Date().toISOString()
});
```

## 📊 Monitoraggio

### SendGrid Dashboard:
- Vai su Activity > Email Activity
- Monitora delivery, bounces, spam reports
- Configura webhook per notifiche real-time

### Log dell'Applicazione:
- Monitora i log della console
- Implementa logging strutturato
- Traccia errori di invio

## 🎯 Prossimi Passi

1. **Scegli** il provider email
2. **Configura** le credenziali
3. **Testa** l'invio
4. **Monitora** le performance
5. **Ottimizza** i template email

## 📞 Supporto

Per problemi specifici:
- **SendGrid**: [Documentazione](https://docs.sendgrid.com/)
- **Gmail**: [Guida App Password](https://support.google.com/accounts/answer/185833)
- **Mailgun**: [Documentazione](https://documentation.mailgun.com/)

---

**Nota**: Il sistema attuale funziona in modalità mock. Segui questa guida per abilitare l'invio reale delle email.

