# Guida Setup N8N per Poltrona

Questa guida ti aiuterà a configurare N8N per il sistema di notifiche di Poltrona.

## Indice

1. [Setup N8N](#1-setup-n8n)
2. [Configurazione Supabase](#2-configurazione-supabase)
3. [Configurazione Email](#3-configurazione-email)
4. [Configurazione WhatsApp](#4-configurazione-whatsapp)
5. [Import Workflow](#5-import-workflow)
6. [Test](#6-test)

---

## 1. Setup N8N

### Opzione A: N8N Cloud (Consigliato)

1. Vai su [n8n.cloud](https://n8n.cloud)
2. Crea un account gratuito
3. Il piano gratuito include:
   - 5 workflow attivi
   - 100 esecuzioni/giorno
   - Sufficiente per un singolo negozio

### Opzione B: Self-Hosted

```bash
# Con Docker
docker run -d --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# Accedi a http://localhost:5678
```

---

## 2. Configurazione Supabase

### 2.1 Esegui Migration

Esegui lo script SQL per creare la tabella notifications:

```bash
# Dalla root del progetto
cat supabase/migrations/001_notifications_table.sql
```

Copia ed esegui in Supabase SQL Editor.

### 2.2 Crea Credenziali N8N

In N8N, vai su **Settings > Credentials > Add Credential > Supabase**

```
Host: https://xxx.supabase.co
Service Role Key: eyJhbG... (da Project Settings > API)
```

⚠️ **Importante**: Usa la **Service Role Key**, non la Anon Key, per bypassare RLS nelle notifiche.

### 2.3 Configura Webhook (per notifiche nuova prenotazione)

1. Supabase Dashboard > Database > Webhooks
2. **Enable Webhooks** se non ancora attivo
3. Crea nuovo webhook:

| Campo | Valore |
|-------|--------|
| Name | `new_appointment_notification` |
| Table | `appointments` |
| Events | `INSERT` |
| Type | `HTTP Request` |
| URL | `https://tuo-n8n.app.n8n.cloud/webhook/new-appointment` |
| Headers | `Authorization: Bearer TUO_SECRET` |

---

## 3. Configurazione Email

### Opzione A: Resend (Consigliato)

1. Registrati su [resend.com](https://resend.com)
2. Verifica il tuo dominio
3. Crea API Key
4. In N8N: **Credentials > Add > HTTP Request**

```
Name: Resend
Authentication: Header Auth
Header Name: Authorization
Header Value: Bearer re_xxxxxxxxxxxx
```

### Opzione B: SMTP (Gmail, Outlook, etc.)

In N8N: **Credentials > Add > SMTP**

**Gmail:**
```
Host: smtp.gmail.com
Port: 587
User: tuo@gmail.com
Password: App Password (non la password normale!)
```

Per generare App Password Gmail:
1. Account Google > Sicurezza
2. Attiva 2FA
3. App Passwords > Genera

---

## 4. Configurazione WhatsApp

### Setup Twilio (Consigliato)

1. Registrati su [twilio.com](https://www.twilio.com)
2. Completa la verifica
3. Vai su **Messaging > Try it out > Send a WhatsApp message**
4. Configura il sandbox per test

### Credenziali N8N

**Credentials > Add > Twilio**

```
Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Auth Token: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Template WhatsApp

Per la produzione, devi creare e far approvare i template:

1. Twilio Console > Messaging > Content Template Builder
2. Crea template `appointment_reminder`:

```
🗓️ *Promemoria Appuntamento*

Ciao {{1}}! Ti ricordiamo il tuo appuntamento per domani:

📅 {{2}} alle {{3}}
💈 {{4}} con {{5}}
📍 {{6}}

Per modifiche, rispondi qui o chiamaci.
```

3. Categoria: `UTILITY`
4. Attendi approvazione (24-48h)

---

## 5. Import Workflow

### Workflow 1: Nuova Prenotazione

1. In N8N, click **Add Workflow**
2. Click sui 3 puntini > **Import from URL** o **Import from File**
3. Segui la struttura in `01-new-appointment-notification.md`
4. Configura i nodi con le tue credenziali
5. Attiva il workflow

### Workflow 2: Reminder Giornaliero

1. Crea nuovo workflow
2. Segui la struttura in `02-daily-appointment-reminder.md`
3. Configura Schedule Trigger per le 10:00
4. Attiva il workflow

---

## 6. Test

### Test Notifica Nuova Prenotazione

1. Assicurati che il workflow sia attivo
2. Crea un appuntamento dall'app Poltrona
3. Verifica:
   - [ ] Email ricevuta dal barbiere
   - [ ] Notifica visibile nella campanella dell'app

### Test Reminder

1. Crea un appuntamento per domani
2. Esegui manualmente il workflow (click **Execute Workflow**)
3. Verifica:
   - [ ] Email reminder ricevuta
   - [ ] WhatsApp ricevuto (usa sandbox Twilio)

---

## Troubleshooting

### Errore 401 Supabase

- Verifica di usare la **Service Role Key**
- Controlla che l'URL Supabase sia corretto

### Email non arrivano

- Controlla la cartella Spam
- Verifica le credenziali SMTP
- Per Gmail, assicurati di usare App Password

### WhatsApp non funziona

- Il sandbox Twilio richiede che il destinatario invii prima un messaggio
- Verifica il formato numero (+39...)
- Controlla i log Twilio per errori

### Workflow non si attiva

- Verifica che il workflow sia **attivo** (toggle verde)
- Controlla i log di esecuzione in N8N
- Per webhook, verifica l'URL nel setup Supabase

---

## Costi Stimati

| Servizio | Piano Gratuito | Costo Produzione |
|----------|----------------|------------------|
| N8N Cloud | 100 exec/giorno | €20/mese (10k exec) |
| Resend | 3000 email/mese | €20/mese (50k) |
| Twilio WhatsApp | $15 credito iniziale | ~€0.05/messaggio |

Per un negozio medio con ~100 appuntamenti/mese:
- **Costo totale stimato**: €20-30/mese

---

## Supporto

- [Documentazione N8N](https://docs.n8n.io/)
- [Documentazione Supabase](https://supabase.com/docs)
- [Documentazione Twilio WhatsApp](https://www.twilio.com/docs/whatsapp)

